import { useState } from 'react'

function ViewFAQ() {
    const [openFaq, setOpenFaq] = useState(null)

    const faqs = [
        { question: 'How accurate are the AI predictions?', answer: 'Our models maintain a back-tested accuracy of 82% over a 3-year period across the S&P 500.' },
        { question: 'Which markets do you cover?', answer: 'We currently cover US equity markets including NYSE and NASDAQ.' },
        { question: 'Can I cancel my subscription anytime?', answer: 'Yes, you can cancel anytime with no hidden fees.' },
    ]

    return (
        <section className="section" id="faq">
            <h2 className="section-title">Frequently Asked Questions</h2>
            {faqs.map((faq, index) => (
                <div className="faq-item" key={index}>
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
