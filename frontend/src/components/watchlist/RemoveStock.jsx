function RemoveStock({ ticker, onRemove }) {
    return (
        <button className="btn-remove" onClick={() => onRemove(ticker)}>
            Remove
        </button>
    )
}

export default RemoveStock
