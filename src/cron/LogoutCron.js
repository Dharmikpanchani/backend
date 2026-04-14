import cron from 'node-cron';
import Admin from '../models/common/Admin.js';
import Teacher from '../models/teacher/Teacher.js';
import Student from '../models/student/Student.js';
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
        'Daily 11:55 PM sync: Logging out Admin, Teacher, and Student'
      );

      const [adminUpdate, teacherUpdate, studentUpdate] = await Promise.all([
        Admin.updateMany({}, { isLogin: false }),
        Teacher.updateMany({}, { isLogin: false }),
        Student.updateMany({}, { isLogin: false }),
      ]);

      logger.info(
        `Daily 11:55 PM logout cron completed successfully: 
        Admins updated: ${adminUpdate.modifiedCount}, 
        Teachers updated: ${teacherUpdate.modifiedCount},
        Students updated: ${studentUpdate.modifiedCount}`
      );
    } catch (error) {
      logger.error('Error in daily 11:55 PM logout cron job:', error);
    }
  });
};
