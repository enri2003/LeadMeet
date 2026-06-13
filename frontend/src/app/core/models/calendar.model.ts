export interface CalendarEventItem {
  id: string;
  title: string;
  type: 'strategy' | 'negotiation' | 'interview' | 'general';
  status: 'scheduled' | 'completed' | 'cancelled' | 'archived';
  startTime: string;
  endTime: string;
  participantCount: number;
  meetingCode: string | null;
  isConfidential: boolean;
}

// Keyed by day-of-month (1-31)
export type CalendarMonthData = Record<number, CalendarEventItem[]>;

export interface DailyNoteDto {
  id: string;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  content: string;
  updatedAt: string;
}

export interface CalendarDay {
  date: Date;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEventItem[];
}

export const EVENT_TYPE_DOT: Record<string, string> = {
  strategy:    'bg-blue-500',
  negotiation: 'bg-yellow-500',
  interview:   'bg-purple-500',
  general:     'bg-white/30',
};

export const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export const DAY_HEADERS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
