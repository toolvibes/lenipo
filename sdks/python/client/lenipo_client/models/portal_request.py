from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.portal_request_project import PortalRequestProject
  from ..models.status_info import StatusInfo





T = TypeVar("T", bound="PortalRequest")



@_attrs_define
class PortalRequest:
    """ 
        Attributes:
            key (str):
            summary (str):
            status (StatusInfo):
            request_type (str):
            project (PortalRequestProject):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    key: str
    summary: str
    status: StatusInfo
    request_type: str
    project: PortalRequestProject
    created_at: datetime.datetime
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.portal_request_project import PortalRequestProject # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        key = self.key

        summary = self.summary

        status = self.status.to_dict()

        request_type = self.request_type

        project = self.project.to_dict()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "status": status,
            "requestType": request_type,
            "project": project,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.portal_request_project import PortalRequestProject # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        status = StatusInfo.from_dict(d.pop("status"))




        request_type = d.pop("requestType")

        project = PortalRequestProject.from_dict(d.pop("project"))




        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        portal_request = cls(
            key=key,
            summary=summary,
            status=status,
            request_type=request_type,
            project=project,
            created_at=created_at,
            updated_at=updated_at,
        )

        return portal_request

