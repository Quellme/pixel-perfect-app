// Mock task data for the first iteration. Replace with DB queries in stage 2.
export type Priority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "active" | "done" | "snoozed" | "dismissed";

export interface Task {
  id: string;
  title: string;
  sender_name: string;
  sender: string;
  subject: string;
  action: string;
  priority: Priority;
  due: string; // human readable
  dueBucket: "now" | "today" | "week";
  status: TaskStatus;
  energy: "high" | "medium" | "quick";
}

export const MOCK_TASKS: Task[] = [
  {
    id: "1",
    title: "Reply to Sarah about Q4 budget review",
    sender_name: "Sarah Chen",
    sender: "sarah@company.com",
    subject: "Re: Q4 Budget — quick question",
    action: "Reply",
    priority: "urgent",
    due: "Overdue · 2 days",
    dueBucket: "now",
    status: "active",
    energy: "high",
  },
  {
    id: "2",
    title: "Pay electricity bill before Friday",
    sender_name: "Octopus Energy",
    sender: "billing@octopus.energy",
    subject: "Your bill is ready",
    action: "Pay",
    priority: "urgent",
    due: "Today",
    dueBucket: "now",
    status: "active",
    energy: "quick",
  },
  {
    id: "3",
    title: "Confirm dentist appointment for Tuesday",
    sender_name: "Bridge Dental",
    sender: "reception@bridgedental.co.uk",
    subject: "Appointment confirmation needed",
    action: "Confirm",
    priority: "high",
    due: "Today",
    dueBucket: "today",
    status: "active",
    energy: "quick",
  },
  {
    id: "4",
    title: "Review proposal from design agency",
    sender_name: "Mara Lin",
    sender: "mara@studiolin.com",
    subject: "Proposal v2 attached",
    action: "Review",
    priority: "medium",
    due: "Today",
    dueBucket: "today",
    status: "active",
    energy: "high",
  },
  {
    id: "5",
    title: "Send school photo permission slip",
    sender_name: "St. Mary's School",
    sender: "office@stmarys.sch.uk",
    subject: "Photo day — signed slip required",
    action: "Sign & reply",
    priority: "medium",
    due: "Thursday",
    dueBucket: "week",
    status: "active",
    energy: "medium",
  },
  {
    id: "6",
    title: "Book flights for the May trip",
    sender_name: "Mum",
    sender: "j.hart@gmail.com",
    subject: "Dates locked in",
    action: "Book",
    priority: "low",
    due: "Next week",
    dueBucket: "week",
    status: "active",
    energy: "medium",
  },
];
