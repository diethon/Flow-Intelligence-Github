
import dns from 'dns';
import mongoose from 'mongoose';
import env from './env';

export const connectDatabase = async (): Promise<void> => {
  try {
    // Configure custom DNS resolution to prevent querySrv ECONNREFUSED on restricted networks
    try {
      dns.setDefaultResultOrder('ipv4first');
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (dnsErr) {
      console.warn('Failed to set custom DNS servers:', dnsErr);
    }

    await mongoose.connect(env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};


