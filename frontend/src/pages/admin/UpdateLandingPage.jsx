import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import '../../styles/admin/adminShared.css'

const EMPTY={hero:{headline:'',subline:'',cta_label:''},
			features:[{title:'',body:''},{title:'',body:''},{title:'',body:''},{title:'',body:''}],
			footer:{tagline:''},
			meta:{title:'',description:''}}

export default function UpdateLandingPage(){
  const [content,setContent]=useState(EMPTY), 
		[loading,setLoading]=useState(true), 
		[saving,setSaving]=useState(false), 
		[alert,setAlert]=useState({msg:'',type:''}), 
		[dirty,setDirty]=useState(false)
  
  useEffect(()=>{
    adminApi.getLandingPage().
	then(c=>setContent({hero:c?.hero||EMPTY.hero,features:c?.features?.length?c.features:EMPTY.features,footer:c?.footer||EMPTY.footer,meta:c?.meta||EMPTY.meta}))
    .catch(err=>setAlert({
		msg:err.message||'Could not load content.',type:'error'}
		))
	.finally(()=>setLoading(false))
  },[])
  
  const mark=()=>{
	  if(!dirty)
		  setDirty(true) 
	  }
  const setH=(f,v)=>{ 
	mark(); 
	setContent(c=>({...c,hero:{...c.hero,[f]:v}})) 
	}
  const setFeat=(i,f,v)=>{ 
	mark(); 
	setContent(c=>{const fs=[...c.features]; 
	fs[i]={...fs[i],[f]:v}; 
	return {...c,features:fs}}) 
	}
  const setFoot=(f,v)=>{ 
	mark(); 
	setContent(c=>({...c,footer:{...c.footer,[f]:v}})) 
	}
  const setMeta=(f,v)=>{ 
	mark(); 
	setContent(c=>({...c,meta:{...c.meta,[f]:v}})) 
	}
	
  const handleSave=async(e)=>{
    e.preventDefault()
    if(!content.hero.headline.trim()){
		setAlert({msg:'Hero headline is required.',type:'error'});
		return
	}
    setSaving(true); 
	setAlert({msg:'',type:''})
    try{ 
		await adminApi.updateLandingPage(content); 
		setDirty(false); 
		showToast('Landing page saved','success'); 
		setAlert({msg:'Changes saved and published.',type:'success'}) 
	}
    catch(err){ 
		setAlert({msg:err.message||'Failed to save.',type:'error'}) 
	}
    finally{ 
		setSaving(false) 
	}
  }
  
  if(loading) 
	  return <div style={{textAlign:'center',padding:'4rem'}}>
				<span className="admin-spinner"/>
				</div>
  return(
    <div>
      <div className="admin-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'1rem'}}>
        <div>
          <h1 className="admin-page-title">Landing Page {dirty&&<span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#ffd600',display:'inline-block',marginLeft:'0.55rem',verticalAlign:'middle'}} title="Unsaved changes"/>}</h1>
          <p className="admin-page-sub">Edit marketing copy shown to visitors on the public home page.</p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="btn-admin btn-ghost">Preview Live Page</a>
      </div>
      {alert.msg&&<div className={`admin-alert ${alert.type}`}>{alert.msg}</div>}
      <form onSubmit={handleSave}>
        <div className="admin-card" style={{marginBottom:'1rem'}}>
          <div className="admin-card-header"><h2 className="admin-card-title">Hero Section</h2></div>
          <div className="admin-card-body">
            <div className="admin-form-group"><label className="admin-form-label">Headline *</label><input className="admin-form-input" type="text" value={content.hero.headline} onChange={e=>setH('headline',e.target.value)} placeholder="Make smarter investment decisions" maxLength={80} required/></div>
            <div className="admin-form-group"><label className="admin-form-label">Subheading</label><textarea className="admin-form-textarea" value={content.hero.subline} onChange={e=>setH('subline',e.target.value)} placeholder="AI-powered predictions…" maxLength={200}/></div>
            <div className="admin-form-group" style={{marginBottom:0}}><label className="admin-form-label">CTA Button Label</label><input className="admin-form-input" type="text" value={content.hero.cta_label} onChange={e=>setH('cta_label',e.target.value)} placeholder="Get Started Free" maxLength={40}/></div>
          </div>
        </div>
        <div className="admin-card" style={{marginBottom:'1rem'}}>
          <div className="admin-card-header"><h2 className="admin-card-title">Feature Cards</h2></div>
          <div className="admin-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              {content.features.map((f,i)=>(
                <div key={i} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'8px',padding:'1rem'}}>
                  <div style={{fontSize:'0.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text-subtle)',marginBottom:'0.7rem'}}>Feature {i+1}</div>
                  <div className="admin-form-group" style={{marginBottom:'0.75rem'}}><label className="admin-form-label">Title</label><input className="admin-form-input" type="text" value={f.title} onChange={e=>setFeat(i,'title',e.target.value)} placeholder={`Feature ${i+1} title`} maxLength={60}/></div>
                  <div className="admin-form-group" style={{marginBottom:0}}><label className="admin-form-label">Description</label><textarea className="admin-form-textarea" value={f.body} onChange={e=>setFeat(i,'body',e.target.value)} placeholder="Short description…" style={{minHeight:'60px'}}/></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="admin-card" style={{marginBottom:'1rem'}}>
          <div className="admin-card-header"><h2 className="admin-card-title">Footer &amp; SEO</h2></div>
          <div className="admin-card-body">
            <div className="admin-form-group"><label className="admin-form-label">Footer Tagline</label><input className="admin-form-input" type="text" value={content.footer.tagline} onChange={e=>setFoot('tagline',e.target.value)} placeholder="All features are completely free." maxLength={120}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              <div className="admin-form-group" style={{marginBottom:0}}><label className="admin-form-label">Page Title (SEO)</label><input className="admin-form-input" type="text" value={content.meta.title} onChange={e=>setMeta('title',e.target.value)} placeholder="StockWise AI" maxLength={70}/></div>
              <div className="admin-form-group" style={{marginBottom:0}}><label className="admin-form-label">Meta Description (SEO)</label><input className="admin-form-input" type="text" value={content.meta.description} onChange={e=>setMeta('description',e.target.value)} placeholder="AI-powered stock predictions…" maxLength={160}/></div>
            </div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:'0.75rem'}}>
          <button type="button" className="btn-admin btn-ghost" disabled={saving} onClick={()=>{setDirty(false);window.location.reload()}}>Discard Changes</button>
          <button type="submit" className="btn-admin btn-primary" disabled={saving}>{saving?<><span className="admin-spinner"/> Saving…</>:'Save & Publish'}</button>
        </div>
      </form>
    </div>
  )
}
