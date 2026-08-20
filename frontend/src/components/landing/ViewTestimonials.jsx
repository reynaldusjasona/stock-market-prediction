// testimonials now come from landing_page_config.content.testimonials (via
// the /landing response), curated by admin feedback approval - see
// appendFeedbackTestimonial() in admin_service.py, which writes each entry
// as {feedback_id, name, quote, rating}. No longer fetched independently.
function ViewTestimonials({ testimonials }) {
    // matches ViewFAQ's pattern: render nothing rather than an empty
    // header/grid until there's real curated content to show
    if (!testimonials || testimonials.length === 0) return null

    return (
        <section className="section" id="testimonials">
            <h2 className="section-title">What Early Investors Are Saying</h2>
            <div className="cards-grid">
                {testimonials.map((t) => (
                    <div className="testimonial-card" key={t.feedback_id || t.name}>
                        <p className="stars">{'★'.repeat(t.rating || 5)}{'☆'.repeat(5 - (t.rating || 5))}</p>
                        <p className="quote">"{t.quote}"</p>
                        <p className="author">{t.name}</p>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default ViewTestimonials
