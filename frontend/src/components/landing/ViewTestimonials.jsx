import { useState, useEffect } from 'react'
import { api } from '../../api/api'

function ViewTestimonials() {
    const [testimonials, setTestimonials] = useState([])

    useEffect(() => {
        api.get('/feedback/public')
            .then((data) => setTestimonials(data.testimonials || []))
            .catch((err) => console.log('testimonials failed:', err.message))
    }, [])

    // matches ViewFAQ's pattern: render nothing rather than an empty
    // header/grid until there's real approved feedback to show
    if (testimonials.length === 0) return null

    return (
        <section className="section" id="testimonials">
            <h2 className="section-title">What Early Investors Are Saying</h2>
            <div className="cards-grid">
                {testimonials.map((t) => (
                    <div className="testimonial-card" key={t.id || t.name}>
                        <p className="stars">{'★'.repeat(t.rating || 5)}{'☆'.repeat(5 - (t.rating || 5))}</p>
                        <p className="quote">"{t.text}"</p>
                        <p className="author">{t.name}</p>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default ViewTestimonials
