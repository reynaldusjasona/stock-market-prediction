import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/api'
import ViewFeedbackPage from './ViewFeedbackPage'
import ApproveFeedbackModal from './ApproveFeedbackModal'
import RejectFeedbackModal from './RejectFeedbackModal'
import '../../styles/admin/adminShared.css'

function ManageFeedbacksPage(){
  const[feedback,setFeedback]= useState([])
  const[loading,setLoading]= useState(true)
  const[approveTarget, setApproveTarget]= useState(null)
  const[rejectTarget,  setRejectTarget]= useState(null)

  const load= async(params={})=>{
    setLoading(true)
    try{
      const d= await adminApi.getAllFeedback(params)
      setFeedback(Array.isArray(d) ? d : (d?.feedback || []))
    } 
	catch (err){
      showToast(err.message||'Failed to load feedback', 'error')
      setFeedback([])
    } 
	finally { 
	  setLoading(false) 
	}
  }

  useEffect(()=>{load()}, [])

  return(
    <>
      <ViewFeedbackPage
        feedback={feedback}
        loading={loading}
        onSearch={q => load(q ? { q } : {})}
        onApprove={item => setApproveTarget(item)}
        onReject={item  => setRejectTarget(item)}
      />
      {approveTarget && <ApproveFeedbackModal target={approveTarget} onClose={() => setApproveTarget(null)} onDone={() => load()}/>}
      {rejectTarget  && <RejectFeedbackModal  target={rejectTarget}  onClose={() => setRejectTarget(null)}  onDone={() => load()}/>}
    </>
  )
}

export default ManageFeedbacksPage
