from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.portal_request_detail_comments_item import PortalRequestDetailCommentsItem
  from ..models.portal_request_detail_project import PortalRequestDetailProject
  from ..models.rich_text import RichText
  from ..models.status_info import StatusInfo





T = TypeVar("T", bound="PortalRequestDetail")



@_attrs_define
class PortalRequestDetail:
    """ 
        Attributes:
            key (str):
            summary (str):
            status (StatusInfo):
            request_type (str):
            project (PortalRequestDetailProject):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            description (None | RichText | str):
            comments (list[PortalRequestDetailCommentsItem]):
     """

    key: str
    summary: str
    status: StatusInfo
    request_type: str
    project: PortalRequestDetailProject
    created_at: datetime.datetime
    updated_at: datetime.datetime
    description: None | RichText | str
    comments: list[PortalRequestDetailCommentsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.portal_request_detail_comments_item import PortalRequestDetailCommentsItem # noqa: PLC0415
        from ..models.portal_request_detail_project import PortalRequestDetailProject # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        key = self.key

        summary = self.summary

        status = self.status.to_dict()

        request_type = self.request_type

        project = self.project.to_dict()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        description: dict[str, Any] | None | str
        if isinstance(self.description, RichText):
            description = self.description.to_dict()
        else:
            description = self.description

        comments = []
        for comments_item_data in self.comments:
            comments_item = comments_item_data.to_dict()
            comments.append(comments_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
            "status": status,
            "requestType": request_type,
            "project": project,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "description": description,
            "comments": comments,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.portal_request_detail_comments_item import PortalRequestDetailCommentsItem # noqa: PLC0415
        from ..models.portal_request_detail_project import PortalRequestDetailProject # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.status_info import StatusInfo # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        status = StatusInfo.from_dict(d.pop("status"))




        request_type = d.pop("requestType")

        project = PortalRequestDetailProject.from_dict(d.pop("project"))




        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        def _parse_description(data: object) -> None | RichText | str:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_output_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_output_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | RichText | str, data)

        description = _parse_description(d.pop("description"))


        comments = []
        _comments = d.pop("comments")
        for comments_item_data in (_comments):
            comments_item = PortalRequestDetailCommentsItem.from_dict(comments_item_data)



            comments.append(comments_item)


        portal_request_detail = cls(
            key=key,
            summary=summary,
            status=status,
            request_type=request_type,
            project=project,
            created_at=created_at,
            updated_at=updated_at,
            description=description,
            comments=comments,
        )

        return portal_request_detail

