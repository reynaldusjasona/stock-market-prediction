import json
import shutil
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight

from ml.training.features import get_multiple_tickers
from ml.training.label_triple_barrier import apply_triple_barrier_by_ticker
from ml.training.train_common import TRAIN_TICKERS, split_data


EXCLUDED_COLUMNS = [
    "Date", "Ticker", "Label",
    "dynamic_target", "next_high", "next_low", "next_close",
    "upper_barrier_price", "lower_barrier_price",
    "Upper_Touched", "Lower_Touched", "Barrier_Type",
]


def create_optuna_objective(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    n_splits: int = 3,
):
    """Create a time-series cross-validation objective for Optuna."""
    time_series_cv = TimeSeriesSplit(n_splits=n_splits)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "n_estimators": trial.suggest_int(
                "n_estimators", 100, 600, step=50
            ),
            "max_depth": trial.suggest_int("max_depth", 2, 8),
            "learning_rate": trial.suggest_float(
                "learning_rate", 0.005, 0.20, log=True
            ),
            "subsample": trial.suggest_float("subsample", 0.60, 1.00),
            "colsample_bytree": trial.suggest_float(
                "colsample_bytree", 0.60, 1.00
            ),
            "min_child_weight": trial.suggest_int(
                "min_child_weight", 1, 15
            ),
            "gamma": trial.suggest_float("gamma", 0.0, 3.0),
            "reg_alpha": trial.suggest_float(
                "reg_alpha", 1e-4, 5.0, log=True
            ),
            "reg_lambda": trial.suggest_float(
                "reg_lambda", 0.1, 10.0, log=True
            ),
            "random_state": 42,
            "n_jobs": -1,
            "tree_method": "hist",
        }

        fold_scores = []

        for fold_number, (train_index, validation_index) in enumerate(
            time_series_cv.split(X_train)
        ):
            X_fold_train = X_train.iloc[train_index]
            X_fold_validation = X_train.iloc[validation_index]
            y_fold_train = y_train[train_index]
            y_fold_validation = y_train[validation_index]

            fold_weights = compute_sample_weight(
                class_weight="balanced",
                y=y_fold_train,
            )

            model = xgb.XGBClassifier(**params)
            model.fit(
                X_fold_train,
                y_fold_train,
                sample_weight=fold_weights,
                verbose=False,
            )

            validation_probabilities = model.predict_proba(
                X_fold_validation
            )[:, 1]

            fold_auc = roc_auc_score(
                y_fold_validation,
                validation_probabilities,
            )
            fold_scores.append(float(fold_auc))

            trial.report(
                float(np.mean(fold_scores)),
                step=fold_number,
            )
            if trial.should_prune():
                raise optuna.TrialPruned()

        return float(np.mean(fold_scores))

    return objective


def train_model_optuna(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
    n_trials: int = 30,
    n_splits: int = 3,
    save_dir: str = "ml/saved_models",
) -> tuple[xgb.XGBClassifier, optuna.Study]:
    """Tune XGBoost with Optuna and fit one final model."""
    objective = create_optuna_objective(
        X_train=X_train,
        y_train=y_train,
        n_splits=n_splits,
    )

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=42),
        pruner=optuna.pruners.MedianPruner(
            n_startup_trials=5,
            n_warmup_steps=1,
        ),
        study_name="xgboost_binary_stock_direction",
    )

    print(
        f"Starting Optuna tuning: "
        f"{n_trials} trials, {n_splits} time-series folds"
    )
    study.optimize(
        objective,
        n_trials=n_trials,
        show_progress_bar=True,
    )

    print(f"Best CV ROC-AUC: {study.best_value:.4f}")
    print("Best parameters:")
    for name, value in study.best_params.items():
        print(f"  {name}: {value}")

    final_params = {
        **study.best_params,
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "random_state": 42,
        "n_jobs": -1,
        "tree_method": "hist",
    }

    final_model = xgb.XGBClassifier(**final_params)
    final_weights = compute_sample_weight(
        class_weight="balanced",
        y=y_train,
    )

    final_model.fit(
        X_train,
        y_train,
        sample_weight=final_weights,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    train_predictions = final_model.predict(X_train)
    validation_predictions = final_model.predict(X_val)
    validation_probabilities = final_model.predict_proba(X_val)[:, 1]

    print(
        f"Train accuracy: "
        f"{accuracy_score(y_train, train_predictions):.4f}"
    )
    print(
        f"Validation accuracy: "
        f"{accuracy_score(y_val, validation_predictions):.4f}"
    )
    print(
        f"Validation macro-F1: "
        f"{f1_score(y_val, validation_predictions, average='macro'):.4f}"
    )
    print(
        f"Validation ROC-AUC: "
        f"{roc_auc_score(y_val, validation_probabilities):.4f}"
    )

    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)

    study.trials_dataframe().to_csv(
        save_path / "optuna_trials.csv",
        index=False,
    )
    with open(
        save_path / "optuna_best_params.json",
        "w",
        encoding="utf-8",
    ) as output_file:
        json.dump(study.best_params, output_file, indent=4)

    return final_model, study


def save_model(
    model: xgb.XGBClassifier,
    label_encoder: LabelEncoder,
    save_dir: str = "ml/saved_models",
) -> str:
    """Save the binary model and its matching label encoder."""
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_file = save_path / f"xgboost_model_{timestamp}.joblib"
    latest_file = save_path / "xgboost_model_latest.joblib"
    encoder_file = save_path / "label_encoder.pkl"

    joblib.dump(model, model_file)
    shutil.copy2(model_file, latest_file)
    joblib.dump(label_encoder, encoder_file)

    return str(model_file.resolve())


def run_training(
    n_trials: int = 60,
    n_splits: int = 3,
) -> dict:
    """Run feature generation, labeling, Optuna tuning, and saving."""
    print("Fetching feature data for all tickers...")
    combined = get_multiple_tickers(TRAIN_TICKERS)

    labeled_data = apply_triple_barrier_by_ticker(
        df=combined,
        ticker_column="Ticker",
        profit_taking_multiplier=1.5,
        stop_loss_multiplier=1.5,
        volatility_window=20,
        min_return=0.005,
        drop_ambiguous=True,
        drop_unlabeled=True,
        binary_only=True,
    )

    feature_columns = [
        column
        for column in labeled_data.columns
        if column not in EXCLUDED_COLUMNS
    ]

    X = labeled_data[feature_columns].copy()
    y = labeled_data["Label"].astype(str)

    print("Dataset built successfully")
    print(y.value_counts())
    print(y.value_counts(normalize=True))

    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)

    label_encoder = LabelEncoder()
    y_train_encoded = label_encoder.fit_transform(y_train)
    y_val_encoded = label_encoder.transform(y_val)

    print(f"Training samples  : {len(X_train)}")
    print(f"Validation samples: {len(X_val)}")
    print(f"Test samples      : {len(X_test)}")
    print(f"Training class distribution:\n{y_train.value_counts()}")
    print(
        f"Label encoder classes: "
        f"{label_encoder.classes_.tolist()}"
    )
    print(f"Feature count: {len(feature_columns)}")

    model, study = train_model_optuna(
        X_train=X_train,
        y_train=y_train_encoded,
        X_val=X_val,
        y_val=y_val_encoded,
        n_trials=n_trials,
        n_splits=n_splits,
    )

    model_path = save_model(
        model=model,
        label_encoder=label_encoder,
    )
    print(f"Model saved to: {model_path}")

    test_probabilities = model.predict_proba(X_test)
    print("First 20 test probabilities:")
    print(test_probabilities[:20])

    return {
        "model_path": model_path,
        "n_train": len(X_train),
        "n_val": len(X_val),
        "n_test": len(X_test),
        "n_features": len(feature_columns),
        "best_cv_roc_auc": round(study.best_value, 4),
        "best_params": study.best_params,
    }


if __name__ == "__main__":
    result = run_training(
        n_trials=60,
        n_splits=3,
    )
    print(result)
