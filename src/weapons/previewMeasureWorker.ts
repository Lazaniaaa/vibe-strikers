import { PreviewMeasureCore } from './previewMeasureCore';
import type { DiagnosticRequest } from './previewMeasureCore';
const core=new PreviewMeasureCore();
self.onmessage=(event:MessageEvent<DiagnosticRequest>)=>{try{self.postMessage(core.measure(event.data));}catch(error){self.postMessage({token:event.data.token,key:event.data.key,error:String(error)});}};
