const {
  evaluateAttachmentEligibility,
  getIntakeYear
} = require('./attachmentEligibilityService');

const createEligibilityDbMock = (attachmentCount = 0) => {
  const emptyReviewQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null)
  };

  const attachmentUsageQuery = {
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: String(attachmentCount) }])
  };

  return jest.fn((table) => {
    if (table === 'attachment_eligibility_reviews') {
      return emptyReviewQuery;
    }

    if (table === 'attachments') {
      return attachmentUsageQuery;
    }

    throw new Error(`Unexpected table ${table}`);
  });
};

describe('attachment eligibility service', () => {
  describe('getIntakeYear', () => {
    test('UT-05 extracts 2022 from HDB212-0324/2022', () => {
      expect(getIntakeYear('HDB212-0324/2022')).toBe(2022);
    });

    test('UT-06 returns an error for malformed registration numbers', () => {
      expect(() => getIntakeYear('malformed string')).toThrow('Invalid registration number format');
    });
  });

  describe('evaluateAttachmentEligibility', () => {
    test('UT-01 returns true for a 3rd-year active student', async () => {
      const db = createEligibilityDbMock();
      const student = {
        id: 'student-1',
        school: 'CHRD',
        program: 'Business Information Technology',
        year_of_study: 3,
        academic_status: 'active'
      };

      const result = await evaluateAttachmentEligibility(db, student);

      expect(result.eligible).toBe(true);
      expect(result.yearOfStudy).toBe(3);
      expect(result.source).toBe('school_rule');
    });

    test('UT-02 returns false for a 1st-year active student', async () => {
      const db = createEligibilityDbMock();
      const student = {
        id: 'student-2',
        school: 'CHRD',
        program: 'Business Information Technology',
        year_of_study: 1,
        academic_status: 'active'
      };

      const result = await evaluateAttachmentEligibility(db, student);

      expect(result.eligible).toBe(false);
      expect(result.yearOfStudy).toBe(1);
      expect(result.canRequestReview).toBe(true);
    });
  });
});
