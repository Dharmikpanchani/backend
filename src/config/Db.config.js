import config from './Index.js';
import mongoose from 'mongoose';
const connectionUrl = config.MONGO_URL;
import Logger from '../utils/Logger.js';
const logger = new Logger('src/config/Db.config.js');

//#region for database connection
const dbConnect = async () => {
  try {
    const connection = await mongoose.connect(connectionUrl, {});
    logger.info(
      'Server Connected With Database',
      connection.connection.db.namespace
    );
  } catch (err) {
    logger.error(err.message);
  }
};

export default dbConnect;
//#endregion
