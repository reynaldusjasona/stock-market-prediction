function ViewNews({ newsItems }) {
    return (
        <div className="tab-content">
            {newsItems.map((article, i) => (
                <div className="news-card" key={i}>
                    <div className="news-card-top">
                        <h3>{article.headline}</h3>
                        {article.sentiment_label && (
                            <span className={'sentiment-badge sentiment-' + article.sentiment_label.toLowerCase()}>
                                {article.sentiment_label}
                            </span>
                        )}
                    </div>
                    <p className="news-summary">{article.summary}</p>
                    <div className="news-card-bottom">
                        <span>{article.source}</span>
                        <span>{article.published_at}</span>
                        <a href={article.url} target="_blank" rel="noreferrer">Read more</a>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default ViewNews
