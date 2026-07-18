function ViewTestimonials() {
    const testimonials = [
        { name: 'Marcus Chen', text: 'The sentiment engine is frighteningly accurate. It caught the NVDA rally three days before the earnings report.' },
        { name: 'Sarah Jenkins', text: 'StockWise AI turned my trading from a hobby into a systematic process. The risk-adjusted return tracking is a game changer.' },
        { name: 'Michael Chen', text: 'The AI predictions for my favorite stocks have been incredibly accurate. Truly an unfair advantage.' },
    ]

    return (
        <section className="section" id="testimonials">
            <h2 className="section-title">What Early Investors Are Saying</h2>
            <div className="cards-grid">
                {testimonials.map((t) => (
                    <div className="testimonial-card" key={t.name}>
                        <p className="stars">★★★★★</p>
                        <p className="quote">"{t.text}"</p>
                        <p className="author">{t.name}</p>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default ViewTestimonials
