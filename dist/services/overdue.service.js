import { NotificationService } from './notification.service.js';
export class OverdueService {
    db;
    notificationService;
    constructor(db) {
        this.db = db;
        this.notificationService = new NotificationService(db);
    }
    /**
     * Checks for activities scheduled more than 4 hours ago without a recorded protocol (Requirement R10).
     * Notifies the Quality Specialist if an expected protocol is missing.
     */
    async checkOverdueProtocols(currentTime = new Date()) {
        // 4 hours in milliseconds = 14,400,000 ms
        const overdueThreshold = new Date(currentTime.getTime() - 4 * 60 * 60 * 1000).toISOString();
        const stmt = this.db.prepare(`
      SELECT s.id, s.project_id, s.activity, s.panel, s.chainage, s.scheduled_at
      FROM protocol_schedules s
      WHERE s.scheduled_at <= ? AND s.notified_overdue_at IS NULL
    `);
        const overdueSchedules = stmt.all(overdueThreshold);
        let notifiedCount = 0;
        for (const item of overdueSchedules) {
            // Check if a protocol has actually been submitted for this panel & chainage
            const existingProtocol = this.db.prepare(`
        SELECT id FROM protocols
        WHERE project_id = ? AND activity = ? AND panel = ? AND chainage = ?
      `).get(item.project_id, item.activity, item.panel, item.chainage);
            if (!existingProtocol) {
                const scheduledTime = new Date(item.scheduled_at).getTime();
                const hoursOverdue = (currentTime.getTime() - scheduledTime) / (1000 * 60 * 60);
                await this.notificationService.notifyOverdueProtocol({
                    projectId: item.project_id,
                    activity: item.activity,
                    panel: item.panel,
                    chainage: item.chainage,
                    scheduledAt: item.scheduled_at,
                    hoursOverdue
                });
                // Mark as notified to prevent duplicate alerts
                this.db.prepare(`
          UPDATE protocol_schedules
          SET notified_overdue_at = ?
          WHERE id = ?
        `).run(currentTime.toISOString(), item.id);
                notifiedCount++;
            }
        }
        return notifiedCount;
    }
}
