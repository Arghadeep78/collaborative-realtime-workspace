import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const rawMongoUri = process.env.DB_CLUSTER_URL || '';
const normalizedMongoUri = rawMongoUri.trim();
const hasDirectUri =
    normalizedMongoUri.startsWith('mongodb://') ||
    normalizedMongoUri.startsWith('mongodb+srv://');
const hasSplitParts = Boolean(
    process.env.DB_USERNAME && process.env.DB_PASSWORD && process.env.DB_CLUSTER_URL
);

const normalizedClusterUrl = normalizedMongoUri.replace(/\/+$/, '');
const clusterUrlWithPath = normalizedClusterUrl.includes('/')
    ? normalizedClusterUrl
    : `${normalizedClusterUrl}/`;

const connectionString = hasDirectUri
    ? normalizedMongoUri
    : hasSplitParts
      ? `mongodb+srv://${process.env.DB_USERNAME}:${encodeURIComponent(process.env.DB_PASSWORD)}@${clusterUrlWithPath}?retryWrites=true&w=majority&appName=Cluster0`
      : '';


const connectionParams = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};

const connectToDatabase = async () => {
    try {
        if (!connectionString) {
            throw new Error(
                'Missing MongoDB connection settings. Set DB_CLUSTER_URL or DB_USERNAME/DB_PASSWORD/DB_CLUSTER_URL.'
            );
        }
        await mongoose.connect(connectionString, connectionParams);
        console.log('Connected to database');
    } catch (err) {
        console.error(`Error connecting to the database.\n${err}`);
    }
};

// Export both values
export { connectionString, connectToDatabase };