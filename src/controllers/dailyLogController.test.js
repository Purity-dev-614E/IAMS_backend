jest.mock('../database/connection', () => jest.fn());
jest.mock('../services/emailService', () => ({
  sendWeeklyReviewRequest: jest.fn()
}));

const db = require('../database/connection');
const { createDailyLog } = require('./dailyLogController');

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('dailyLogController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('UT-07 rejects a daily log with a future log_date', async () => {
    const studentQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 'student-1', user_id: 'user-1' })
    };
    const attachmentQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 'attachment-1', student_id: 'student-1' })
    };
    const dailyLogsQuery = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn()
    };

    db.mockImplementation((table) => {
      if (table === 'students') return studentQuery;
      if (table === 'attachments') return attachmentQuery;
      if (table === 'daily_logs') return dailyLogsQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const req = {
      user: { id: 'user-1', role: 'student' },
      body: {
        attachment_id: 'attachment-1',
        log_date: tomorrow.toISOString().slice(0, 10),
        tasks_performed: 'Worked on assigned tasks.',
        skills_acquired: 'Practised API testing.',
        observations: '',
        status: 'submitted'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await createDailyLog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Log date cannot be in the future'
    });
    expect(dailyLogsQuery.insert).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
