import { useState, useEffect } from 'react'
import { api } from '../../api/api'

function ViewFAQ() {
    const [openFaq, setOpenFaq] = useState(null)
    const [faqs, setFaqs] = useState([])

    useEffect(() => {
        api.get('/faq')
            .then((data) => setFaqs(data.faqs || []))
            .catch((err) => console.log('faq failed:', err.message))
    }, [])

    if (faqs.length === 0) return null

    return (
        <section className="section" id="faq">
            <h2 className="section-title">Frequently Asked Questions</h2>
            {faqs.map((faq, index) => (
                <div className="faq-item" key={faq.id || index}>
                    <div className="faq-question" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                        <span>{faq.question}</span>
                        <span>{openFaq === index ? '∧' : '∨'}</span>
                    </div>
                    {openFaq === index && <p className="faq-answer">{faq.answer}</p>}
                </div>
            ))}
        </section>
    )
}

export default ViewFAQ
