function ViewLandingSection({ section }) {
    if (!section) return null

    return (
        <section className="section" id={section.section_key}>
            <h2 className="section-title">{section.title}</h2>
            {section.subtitle && <p className="section-sub">{section.subtitle}</p>}
            {section.image_url && (
                <img className="section-image" src={section.image_url} alt={section.title} />
            )}
            {section.content && <p className="section-content">{section.content}</p>}
        </section>
    )
}

export default ViewLandingSection
