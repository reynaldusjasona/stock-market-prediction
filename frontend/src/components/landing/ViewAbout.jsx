function ViewAbout() {
    return (
        <section className="section" id="about">
            <h2 className="section-title">About StockWise AI</h2>
            <p className="section-sub">Institutional-grade intelligence, built for the everyday investor.</p>
            <div className="cards-grid">
                <div className="card">
                    <h3>AI Predictions You Can Trust</h3>
                    <p>Every forecast comes with a confidence score, so you know the odds before you act.</p>
                </div>
                <div className="card">
                    <h3>The Market, Read in Real Time</h3>
                    <p>We scan news, SEC filings, and social sentiment across US equities the moment they move.</p>
                </div>
                <div className="card">
                    <h3>Catch Moves Before They Happen</h3>
                    <p>Spot sentiment surges and momentum shifts early, not after the price has already run.</p>
                </div>
            </div>
        </section>
    )
}

export default ViewAbout
