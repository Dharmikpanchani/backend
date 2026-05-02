import cron from 'node-cron';
import Admin from '../models/common/Admin.js';
import Teacher from '../models/teacher/Teacher.js';
import Student from '../models/student/Student.js';
import User from '../models/user/User.js';
import Logger from '../utils/Logger.js';

const logger = new Logger('./src/cron/LogoutCron.js');

/**
 * Initializes a cron job to log out all users daily at 12:00 AM.
 * Sets isLogin to false for DeveloperAdmin, SchoolAdmin, and User models.
 */
export const initLogoutCron = () => {
  // schedule runs every day at 11:55 PM
  cron.schedule('55 23 * * *', async () => {
    try {
      logger.info(
        'Daily 11:55 PM sync: Logging out Admin, Teacher, Student, and User'
      );

      const [adminUpdate, teacherUpdate, studentUpdate, userUpdate] =
        await Promise.all([
          Admin.updateMany({}, { isLogin: false }),
          Teacher.updateMany({}, { isLogin: false }),
          Student.updateMany({}, { isLogin: false }),
          User.updateMany({}, { isLogin: false }),
        ]);

      logger.info(
        `Daily 11:55 PM logout cron completed successfully: 
        Admins updated: ${adminUpdate.modifiedCount}, 
        Teachers updated: ${teacherUpdate.modifiedCount},
        Students updated: ${studentUpdate.modifiedCount},
        Users updated: ${userUpdate.modifiedCount}`
      );
    } catch (error) {
      logger.error('Error in daily 11:55 PM logout cron job:', error);
    }
  });
};
