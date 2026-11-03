from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.import_job_state import ImportJobState
from ..models.import_source import ImportSource
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.import_job_created_by_type_0 import ImportJobCreatedByType0
  from ..models.import_report import ImportReport





T = TypeVar("T", bound="ImportJob")



@_attrs_define
class ImportJob:
    """ 
        Attributes:
            id (UUID):
            source (ImportSource):
            dry_run (bool):
            label (str):
            state (ImportJobState):
            progress (str):
            log (list[str]):
            report (ImportReport | None):
            created_by (ImportJobCreatedByType0 | None):
            created_at (datetime.datetime):
            finished_at (datetime.datetime | None):
     """

    id: UUID
    source: ImportSource
    dry_run: bool
    label: str
    state: ImportJobState
    progress: str
    log: list[str]
    report: ImportReport | None
    created_by: ImportJobCreatedByType0 | None
    created_at: datetime.datetime
    finished_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.import_job_created_by_type_0 import ImportJobCreatedByType0 # noqa: PLC0415
        from ..models.import_report import ImportReport # noqa: PLC0415
        id = str(self.id)

        source = self.source.value

        dry_run = self.dry_run

        label = self.label

        state = self.state.value

        progress = self.progress

        log = self.log



        report: dict[str, Any] | None
        if isinstance(self.report, ImportReport):
            report = self.report.to_dict()
        else:
            report = self.report

        created_by: dict[str, Any] | None
        if isinstance(self.created_by, ImportJobCreatedByType0):
            created_by = self.created_by.to_dict()
        else:
            created_by = self.created_by

        created_at = self.created_at.isoformat()

        finished_at: None | str
        if isinstance(self.finished_at, datetime.datetime):
            finished_at = self.finished_at.isoformat()
        else:
            finished_at = self.finished_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "source": source,
            "dryRun": dry_run,
            "label": label,
            "state": state,
            "progress": progress,
            "log": log,
            "report": report,
            "createdBy": created_by,
            "createdAt": created_at,
            "finishedAt": finished_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.import_job_created_by_type_0 import ImportJobCreatedByType0 # noqa: PLC0415
        from ..models.import_report import ImportReport # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        source = ImportSource(d.pop("source"))




        dry_run = d.pop("dryRun")

        label = d.pop("label")

        state = ImportJobState(d.pop("state"))




        progress = d.pop("progress")

        log = cast(list[str], d.pop("log"))


        def _parse_report(data: object) -> ImportReport | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                report_type_0 = ImportReport.from_dict(data)



                return report_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ImportReport | None, data)

        report = _parse_report(d.pop("report"))


        def _parse_created_by(data: object) -> ImportJobCreatedByType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                created_by_type_0 = ImportJobCreatedByType0.from_dict(data)



                return created_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ImportJobCreatedByType0 | None, data)

        created_by = _parse_created_by(d.pop("createdBy"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        def _parse_finished_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                finished_at_type_0 = datetime.datetime.fromisoformat(data)



                return finished_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        finished_at = _parse_finished_at(d.pop("finishedAt"))


        import_job = cls(
            id=id,
            source=source,
            dry_run=dry_run,
            label=label,
            state=state,
            progress=progress,
            log=log,
            report=report,
            created_by=created_by,
            created_at=created_at,
            finished_at=finished_at,
        )

        return import_job

