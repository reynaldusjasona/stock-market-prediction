_FINBERT_PIPELINE = None

def _get_finbert_pipeline():
    """
    Construct and cache the FinBERT sentiment pipeline.

    Uses FinBERT model to classify text into positive, negative, or neutral sentiment. 
    The model is returning one of: positive, negative, neutral, each with a
    confidence score.
    """
    global _FINBERT_PIPELINE
    if _FINBERT_PIPELINE is None:
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            pipeline,
        )

        tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        model = AutoModelForSequenceClassification.from_pretrained(
            "ProsusAI/finbert"
        )
        _FINBERT_PIPELINE = pipeline(
            "sentiment-analysis",
            model=model,
            tokenizer=tokenizer,
            truncation=True,
            max_length=128,
        )
    return _FINBERT_PIPELINE


def score_headlines(
    texts: list[str],
    batch_size: int = 128,
) -> list[float]:
    """
    Score multiple headlines with FinBERT in batches.

    Args:
        texts:
            English financial headlines.

        batch_size:
            Number of headlines passed through FinBERT at once.

    Returns:
        Signed sentiment scores in the range [-1, 1].
    """
    if not texts:
        return []

    cleaned = [
        text.strip() if text and text.strip() else ""
        for text in texts
    ]

    classifier = _get_finbert_pipeline()

    results = classifier(
        cleaned,
        batch_size=batch_size,
        truncation=True,
        max_length=128,
    )

    scores: list[float] = []

    for text, result in zip(cleaned, results):
        if not text:
            scores.append(0.0)
            continue

        label = str(result["label"]).lower()
        confidence = float(result["score"])

        if label == "positive":
            scores.append(confidence)
        elif label == "negative":
            scores.append(-confidence)
        else:
            scores.append(0.0)

    return scores


def get_sentiment_label(
    score: float,
    threshold: float = 0.05,
) -> str:
    """
    Convert a signed sentiment score into a sentiment label.

    Args:
        score:
            Signed sentiment score in the range [-1, 1].

        threshold:
            Minimum absolute score required to classify the result
            as positive or negative.

    Returns:
        "positive", "negative", or "neutral".
    """
    if score > threshold:
        return "positive"

    if score < -threshold:
        return "negative"

    return "neutral"