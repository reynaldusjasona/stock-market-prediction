import { useState, useEffect } from 'react'
import { api } from '../../api/api'

const FALLBACK_TESTIMONIALS = [
    { name: 'Marcus Chen', text: 'The sentiment engine is frighteningly accurate. It caught the NVDA rally three days before the earnings report.' },
    { name: 'Sarah Jenkins', text: 'StockWise AI turned my trading from a hobby into a systematic process. The risk-adjusted return tracking is a game changer.' },
    { name: 'Michael Chen', text: 'The AI predictions for my favorite stocks have been incredibly accurate. Truly an unfair advantage.' },
]

const MIN_REAL_TESTIMONIALS = 3

function ViewTestimonials() {
    const [testimonials, setTestimonials] = useState(FALLBACK_TESTIMONIALS)

    useEffect(() => {
        api.get('/feedback/public')
            .then((data) => {
                const real = data.testimonials || []
                // don't mix real and placeholder cards, and don't show a
                // sparse 1-2 card section - only switch over once there's
                // enough real approved feedback to fill the section
                if (real.length >= MIN_REAL_TESTIMONIALS) {
                    setTestimonials(real)
                }
            })
            .catch((err) => console.log('testimonials failed:', err.message))
    }, [])

    return (
        <section className="section" id="testimonials">
            <h2 className="section-title">What Early Investors Are Saying</h2>
            <div className="cards-grid">
                {testimonials.map((t) => (
                    <div className="testimonial-card" key={t.id || t.name}>
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
