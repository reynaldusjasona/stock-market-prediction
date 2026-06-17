import joblib

model = joblib.load(
    r"ml\saved_models\xgboost_model_20260617_183154.joblib"
)

features = [
    "Open", "High", "Low", "Close", "Volume",
    "SMA20", "EMA20", "RSI14", "MACD",
    "MACD_Signal", "BB_Upper", "BB_Lower", "BB_Width",
    "Return_1D", "Return_5D", "Return_10D",
    "Volatility_10D", "Volume_Ratio",
    "Dist_SMA20", "Dist_EMA20"
]

print("Features:", len(features))
print("Importances:", len(model.feature_importances_))

for feature, importance in zip(features, model.feature_importances_):
    print(f"{feature}: {importance:.4f}")