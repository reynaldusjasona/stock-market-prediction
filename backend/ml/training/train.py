import argparse
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
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight

from ml.training.features import (
    get_feature_columns_for_horizon,
    get_multiple_tickers,
)
from ml.training.label_triple_barrier import apply_triple_barrier_by_ticker
from ml.training.train_common import (
    TRAIN_TICKERS,
    get_artifact_names,
    get_model_feature_columns,
    iter_purged_time_series_splits,
    split_data,
)


def create_optuna_objective(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    train_dates: pd.Series,
    horizon_days: int,
    n_splits: int = 3,
):
    """Create purged, date-aware time-series cross-validation objective."""
    def objective(trial: optuna.Trial) -> float:
        params = {
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "n_estimators": trial.suggest_int("n_estimators", 100, 600, step=50),
            "max_depth": trial.suggest_int("max_depth", 2, 8),
            "learning_rate": trial.suggest_float(
                "learning_rate", 0.005, 0.20, log=True
            ),
            "subsample": trial.suggest_float("subsample", 0.60, 1.00),
            "colsample_bytree": trial.suggest_float(
                "colsample_bytree", 0.60, 1.00
            ),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 15),
            "gamma": trial.suggest_float("gamma", 0.0, 3.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 5.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 10.0, log=True),
            "random_state": 42,
            "n_jobs": -1,
            "tree_method": "hist",
        }
        scores = []
        folds = iter_purged_time_series_splits(
            dates=train_dates,
            n_splits=n_splits,
            purge_days=horizon_days,
        )
        for fold_number, (train_index, validation_index) in enumerate(folds):
            X_fold_train = X_train.iloc[train_index]
            X_fold_validation = X_train.iloc[validation_index]
            y_fold_train = y_train[train_index]
            y_fold_validation = y_train[validation_index]
            weights = compute_sample_weight("balanced", y_fold_train)
            model = xgb.XGBClassifier(**params)
            model.fit(X_fold_train, y_fold_train, sample_weight=weights, verbose=False)
            probabilities = model.predict_proba(X_fold_validation)[:, 1]
            scores.append(float(roc_auc_score(y_fold_validation, probabilities)))
            trial.report(float(np.mean(scores)), step=fold_number)
            if trial.should_prune():
                raise optuna.TrialPruned()
        if not scores:
            raise ValueError("No valid purged time-series folds were produced.")
        return float(np.mean(scores))
    return objective


def train_model_optuna(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    train_dates: pd.Series,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
    horizon_days: int,
    n_trials: int = 60,
    n_splits: int = 3,
    save_dir: str = "ml/saved_models",
) -> tuple[xgb.XGBClassifier, optuna.Study]:
    names = get_artifact_names(horizon_days)
    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=42),
        pruner=optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=1),
        study_name=names["study_name"],
    )
    study.optimize(
        create_optuna_objective(
            X_train, y_train, train_dates, horizon_days, n_splits
        ),
        n_trials=n_trials,
        show_progress_bar=True,
    )
    params = {
        **study.best_params,
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "random_state": 42,
        "n_jobs": -1,
        "tree_method": "hist",
    }
    model = xgb.XGBClassifier(**params)
    weights = compute_sample_weight("balanced", y_train)
    model.fit(
        X_train,
        y_train,
        sample_weight=weights,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    train_pred = model.predict(X_train)
    val_pred = model.predict(X_val)
    val_prob = model.predict_proba(X_val)[:, 1]
    print(f"Best CV ROC-AUC: {study.best_value:.4f}")
    print(f"Train accuracy: {accuracy_score(y_train, train_pred):.4f}")
    print(f"Validation accuracy: {accuracy_score(y_val, val_pred):.4f}")
    print(f"Validation macro-F1: {f1_score(y_val, val_pred, average='macro'):.4f}")
    print(f"Validation ROC-AUC: {roc_auc_score(y_val, val_prob):.4f}")

    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)
    study.trials_dataframe().to_csv(save_path / names["optuna_trials"], index=False)
    with (save_path / names["optuna_best_params"]).open("w", encoding="utf-8") as file:
        json.dump(study.best_params, file, indent=4)
    return model, study


def save_model(
    model: xgb.XGBClassifier,
    label_encoder: LabelEncoder,
    horizon_days: int,
    save_dir: str = "ml/saved_models",
) -> str:
    names = get_artifact_names(horizon_days)
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    versioned = save_path / f"{names['model_prefix']}_{timestamp}.joblib"
    joblib.dump(model, versioned)
    shutil.copy2(versioned, save_path / names["latest_model"])
    joblib.dump(label_encoder, save_path / names["label_encoder"])
    return str(versioned.resolve())


def run_training(
    horizon_days: int = 1,
    n_trials: int = 60,
    n_splits: int = 3,
    save_dir: str = "ml/saved_models",
) -> dict:
    """Train one isolated horizon using the shared StockWise methodology."""
    if horizon_days not in {1, 3, 5}:
        raise ValueError("horizon_days must be one of 1, 3, or 5.")
    print(f"\n=== TRAINING {horizon_days}-DAY MODEL ===")
    combined = get_multiple_tickers(TRAIN_TICKERS)
    labeled = apply_triple_barrier_by_ticker(
        df=combined,
        ticker_column="Ticker",
        profit_taking_multiplier=1.5,
        stop_loss_multiplier=1.5,
        volatility_window=20,
        min_return=0.005,
        drop_ambiguous=True,
        drop_unlabeled=True,
        binary_only=True,
        horizon_days=horizon_days,
    )
    feature_whitelist = get_feature_columns_for_horizon(horizon_days)
    feature_columns = get_model_feature_columns(
        labeled,
        feature_whitelist,
    )
    X = labeled[feature_columns].copy()
    y = labeled["Label"].astype(str)
    dates = pd.to_datetime(labeled["Date"], errors="raise")
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(
        X, y, dates=dates, purge_days=horizon_days
    )
    train_dates = dates.loc[X_train.index].reset_index(drop=True)
    X_train = X_train.reset_index(drop=True)
    X_val = X_val.reset_index(drop=True)
    X_test = X_test.reset_index(drop=True)
    y_train = y_train.reset_index(drop=True)
    y_val = y_val.reset_index(drop=True)

    encoder = LabelEncoder()
    y_train_encoded = encoder.fit_transform(y_train)
    y_val_encoded = encoder.transform(y_val)
    print(f"Training/validation/test: {len(X_train)}/{len(X_val)}/{len(X_test)}")
    print(f"Label classes: {encoder.classes_.tolist()}")
    print(f"Feature count: {len(feature_columns)}")
    print(f"Features: {feature_columns}")
    model, study = train_model_optuna(
        X_train=X_train,
        y_train=y_train_encoded,
        train_dates=train_dates,
        X_val=X_val,
        y_val=y_val_encoded,
        horizon_days=horizon_days,
        n_trials=n_trials,
        n_splits=n_splits,
        save_dir=save_dir,
    )
    model_path = save_model(model, encoder, horizon_days, save_dir)
    print(f"{horizon_days}-day model saved to: {model_path}")
    return {
        "horizon_days": horizon_days,
        "model_path": model_path,
        "n_train": len(X_train),
        "n_val": len(X_val),
        "n_test": len(X_test),
        "n_features": len(feature_columns),
        "best_cv_roc_auc": round(study.best_value, 4),
        "best_params": study.best_params,
    }


def run_training_three_day(**kwargs) -> dict:
    return run_training(horizon_days=3, **kwargs)


def run_training_five_day(**kwargs) -> dict:
    return run_training(horizon_days=5, **kwargs)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--horizon", choices=("1", "3", "5", "all"), default="5")
    parser.add_argument("--trials", type=int, default=60)
    parser.add_argument("--splits", type=int, default=3)
    parser.add_argument("--save-dir", default="ml/saved_models")
    args = parser.parse_args()
    horizons = (1, 3, 5) if args.horizon == "all" else (int(args.horizon),)
    results = {}
    for horizon in horizons:
        results[f"{horizon}day"] = run_training(
            horizon_days=horizon,
            n_trials=args.trials,
            n_splits=args.splits,
            save_dir=args.save_dir,
        )
    print(results)


if __name__ == "__main__":
    main()