export type Student = {
  id: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
  gender: '남' | '여';
  accessCode: string; // 5-digit unique access code
  personalCode?: string; // 교무 관리용 개인코드 (학교 자체 식별코드)
  photoUrl?: string; // 학생 사진 URL (선택 사항)

  // 건강기록부 연동용 인적사항 및 이력
  residentRegistrationNumber?: string;
  guardianName?: string;
  bloodType?: string;
  officialSchoolName?: string;
  teacherName?: string;
  schoolHistory?: SchoolHistoryEntry[];
  preSchoolImmunizations?: PreSchoolImmunization;
  postSchoolImmunizations?: PostSchoolImmunization[];
  healthExams?: {
    [grade: string]: {
      general?: HealthExam;
      dental?: HealthExam;
    }
  };
  otherExams?: OtherExam[];
};

export type StudentToAdd = Omit<Student, 'id' | 'accessCode' | 'photoUrl'>;
export type StudentToUpdate = Partial<Omit<Student, 'id' | 'accessCode' | 'school'>>;

export type RecordType = 'time' | 'count' | 'distance' | 'weight' | 'level' | 'compound';

export type MeasurementItem = {
  id: string;
  name: string;
  unit: string;
  recordType: RecordType;
  goal?: number; // Optional goal for non-PAPS items
  isPaps: boolean;
  isCompound?: boolean; // For items like BMI that require multiple inputs
  category?: string; // Optional category for custom items
  isArchived?: boolean; // To hide from UI without deleting records (Hidden)
  isDeactivated?: boolean; // To remove from lists but keep in catalog (Deactivated)
  isMeasurementWeek?: boolean; // 명예의 전당 표시를 위한 측정 주간 설정
  videoUrl?: string; // 측정 방법 예시 영상 (YouTube URL)
};

export type MeasurementRecord = {
  id: string;
  studentId: string;
  school: string;
  item: string; // The name of the measurement item
  value: number;
  date: string; // YYYY-MM-DD
  note?: string; // 비고
  height?: number; // BMI용 키 데이터
  weight?: number; // BMI용 몸무게 데이터
};

export type MeasurementPeriod = {
  id: string;
  name: string; // 예: 1차 측정, 2차 측정
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

export type ItemStatistics = {
  id: string; // itemName
  gradeStats: {
    [grade: string]: {
      average: number;
      count: number;
      topRanks: { studentId: string; rank: number; value: number; name: string; classNum: string }[];
      allRanks: { studentId: string; rank: number; value: number }[];
      gradeDistribution?: Record<string, number>;
    }
  };
  lastUpdated: any;
};

export type StudentLogin = Omit<Student, 'id' | 'gender'>;

export type School = {
  id: string;
  name: string;
  password?: string;
  createdAt: any; // Can be a Date or a server timestamp
  isStudentInputDisabled?: boolean; // 학생 입력 제한 설정
  measurementPeriods?: MeasurementPeriod[]; // 학교 공통 측정 주간 설정

  // 지정 검진기관 리스트
  healthExamInstitutions?: string[];
  dentalExamInstitutions?: string[];

  // 건강기록부 설정
  officialSchoolName?: string;       // 정식 학교 명칭 (예: 호치민한국국제학교)
  healthRecord_showGuardian?: boolean; // 건강기록부에 보호자 성명 표시 여부 (기본 true)
  healthRecord_showBloodType?: boolean; // 건강기록부에 혈액형 표시 여부 (기본 true)
};

export type SportsClub = {
  id: string;
  school: string;
  name: string;
  memberIds: string[];
  createdAt: any;
};

export type Team = {
  id: string;
  name: string;
  teamIndex: number;
  memberIds: string[];
  members?: Student[]; // Optional, populated on client
  // For league stats
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  points?: number;
};

export type TeamGroup = {
  id: string;
  school: string;
  description: string;
  teams: Team[];
  itemNamesForBalancing: string[]; // 능력치 기준 종목
  createdAt: any;
  // Metadata for reloading the state
  analysisScope: 'all' | 'grade' | 'class';
  grade?: string;
  classNum?: string;
  gender?: 'all' | '남' | '여' | 'separate';
  divideBy?: 'teams' | 'members' | 'single';
  numTeams?: number;
  membersPerTeam?: number;
  balancingStrategy?: 'balanced' | 'by-ability' | 'random';
};

export type TeamGroupInput = Omit<TeamGroup, 'id' | 'createdAt' | 'teams'> & {
  teams: (Omit<Team, 'id'> & { id?: string })[];
};


// --- Tournament Types ---
export type Match = {
  id: string;
  round?: number; // For tournaments
  matchNumber: number; // For tournaments
  teamAId: string | null;
  teamBId: string | null;
  scoresA: number[];
  scoresB: number[];
  winnerId: string | null;
  status: 'scheduled' | 'completed' | 'bye';
  nextMatchId: string | null;
  nextMatchSlot: 'A' | 'B' | null;
  tournamentName?: string; // For sport-specific page context
  teamNameA?: string;
  teamNameB?: string;
};

export type IndividualLeagueParticipant = {
  id: string;
  name: string;
  totalPoints: number;
  status: 'active' | 'eliminated';
  initialRank: number; // For tie-breaking
};


export type Tournament = {
  id: string;
  school: string;
  name: string;
  sport?: 'soccer' | 'basketball' | 'volleyball' | 'baseball' | 'dodgeball' | 'etc';
  type: 'tournament' | 'league' | 'individual-league';
  tournamentFormat?: 'single-elimination' | 'double-elimination';
  bestOf?: 1 | 3 | 5 | 7;
  teamGroupId?: string;
  teams: Team[]; // 직접 팀 정보를 저장
  matches: Match[];
  createdAt: any;
  date?: string; // YYYY-MM-DD for match day
  meetingsPerTeam?: number;
  // For manual audience targeting
  grade?: string;
  gender?: 'all' | '남' | '여';

  // For individual points league
  participants?: IndividualLeagueParticipant[];
  pointsPerWin?: number;
  membersPerTeam?: number;
  currentRound?: number;
  isFinished?: boolean;
};

// --- Quiz Types ---
export type QuizQuestion = {
  type: 'multiple-choice' | 'short-answer' | 'ox' | 'fill-in-the-blanks';
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
};

export type Quiz = {
  id: string;
  school: string;
  title: string;
  content: string; // The source material
  questions: QuizQuestion[];
  videoUrl?: string; // 참고 영상 URL
  createdAt: any;
};

export type QuizAssignment = {
  id: string;
  quizId: string;
  quizTitle: string;
  questions?: QuizQuestion[]; // 문제를 배포 시점에 직접 포함
  videoUrl?: string; // 배포된 퀴즈의 참고 영상 URL
  school: string;
  targetType: 'class' | 'grade' | 'school' | 'club';
  targetGrade?: string;
  targetClassNum?: string;
  targetClubId?: string;
  targetClubName?: string;
  createdAt: any;
  status: 'active' | 'closed';
};

export type QuizResult = {
  id: string;
  assignmentId: string;
  studentId: string;
  score: number;
  total: number;
  passed: boolean;
  createdAt: any;
};

// --- 건강기록부 세부 타입 ---
export type SchoolHistoryEntry = {
  year?: string;       // 학년도 (예: "2024")
  schoolName: string;
  grade: string;
  classNum: string;
  studentNum: string;
  teacherName: string;
};

export type PreSchoolImmunization = {
  [disease: string]: boolean[]; // 1차~5차 여부 체크 (예: [true, true, false, false, false])
};

export type PostSchoolImmunization = {
  diseaseName: string;
  grade: string;
  date: string;
};

export type HealthExam = {
  date: string;
  institution: string;
};

export type OtherExam = {
  date: string;
  examName: string;
  institution: string;
};
