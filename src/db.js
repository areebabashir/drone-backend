import mongoose from 'mongoose';
let pending;
export async function connectDB(){
 if(mongoose.connection.readyState===1) return;
 if(!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
 if(!pending) pending=mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:7000}).catch(e=>{pending=null;throw e});
 await pending;
}
