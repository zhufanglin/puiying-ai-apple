"""学生事务服务聚合入口。"""

from app.modules.apple.students.attendance_service import AttendanceService
from app.modules.apple.students.certificate_service import CertificateService
from app.modules.apple.students.student_service import StudentService

__all__ = ["StudentService", "AttendanceService", "CertificateService"]

