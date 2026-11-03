from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.publish_workflow_request import PublishWorkflowRequest
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="WorkflowDraft")



@_attrs_define
class WorkflowDraft:
    """ 
        Attributes:
            request (PublishWorkflowRequest):
            updated_by (None | UserRef):
            updated_at (datetime.datetime):
            stale (bool):
     """

    request: PublishWorkflowRequest
    updated_by: None | UserRef
    updated_at: datetime.datetime
    stale: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.publish_workflow_request import PublishWorkflowRequest # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        request = self.request.to_dict()

        updated_by: dict[str, Any] | None
        if isinstance(self.updated_by, UserRef):
            updated_by = self.updated_by.to_dict()
        else:
            updated_by = self.updated_by

        updated_at = self.updated_at.isoformat()

        stale = self.stale


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "request": request,
            "updatedBy": updated_by,
            "updatedAt": updated_at,
            "stale": stale,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.publish_workflow_request import PublishWorkflowRequest # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        request = PublishWorkflowRequest.from_dict(d.pop("request"))




        def _parse_updated_by(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                updated_by_type_0 = UserRef.from_dict(data)



                return updated_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        updated_by = _parse_updated_by(d.pop("updatedBy"))


        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        stale = d.pop("stale")

        workflow_draft = cls(
            request=request,
            updated_by=updated_by,
            updated_at=updated_at,
            stale=stale,
        )

        return workflow_draft

