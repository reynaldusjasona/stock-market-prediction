import {useState} from 'react'
import {debounce} from '../../js/adminUi'

const debouncedSearch= debounce((fn, q)=>fn(q),280)

function SearchAlertsComponent({onSearch}){
  const [value, setValue]= useState('')

  const handleChange=(e)=>{
    const q= e.target.value
    setValue(q)
    debouncedSearch(onSearch, q.trim())
  }

  return(
    <div className="admin-search-wrap">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
        <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
      <input
        className="admin-search-input"
        type="text"
        placeholder="Search alerts…"
        value={value}
        onChange={handleChange}
        onKeyDown={e => { if (e.key === 'Escape'){ 
							setValue(''); 
							onSearch('') } 
						}}
        autoComplete="off"
        aria-label="Search alerts"
      />
      {value && (
        <button
          onClick={()=>{ setValue(''); onSearch('') }}
          aria-label="Clear search"
          style={{
            position:'absolute', right:'0.6rem', top:'50%',
            transform:'translateY(-50%)', background:'none', border:'none',
            cursor:'pointer', color:'var(--text-subtle)', padding:0, display:'flex',
          }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default SearchAlertsComponent
