import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 deviceId:{type:String,required:true,index:true,maxlength:64},simulation:{type:Boolean,default:true},
 mode:{type:String,required:true},latitude:Number,longitude:Number,altitudeM:Number,batteryPct:Number,
 waypoint:Number,obstacleCm:Number,temperatureC:Number,humidityPct:Number,thermalSimC:Number,
 syntheticDetections:Number,lastConfidenceSim:Number,
 motorPWM:[Number],motorRPMEstimated:[Number],receivedAt:{type:Date,default:Date.now,index:true}
},{versionKey:false});
schema.index({deviceId:1,receivedAt:-1});
export default mongoose.models.Telemetry || mongoose.model('Telemetry',schema);
