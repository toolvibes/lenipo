from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.page_approval_mode import PageApprovalMode
from typing import cast

if TYPE_CHECKING:
  from ..models.page_approval_pending_type_0 import PageApprovalPendingType0
  from ..models.page_approval_rejected_type_0 import PageApprovalRejectedType0





T = TypeVar("T", bound="PageApproval")



@_attrs_define
class PageApproval:
    """ 
        Attributes:
            mode (PageApprovalMode):
            required (bool):
            can_approve (bool):
            pending (None | PageApprovalPendingType0):
            rejected (None | PageApprovalRejectedType0):
     """

    mode: PageApprovalMode
    required: bool
    can_approve: bool
    pending: None | PageApprovalPendingType0
    rejected: None | PageApprovalRejectedType0





    def to_dict(self) -> dict[str, Any]:
        from ..models.page_approval_pending_type_0 import PageApprovalPendingType0 # noqa: PLC0415
        from ..models.page_approval_rejected_type_0 import PageApprovalRejectedType0 # noqa: PLC0415
        mode = self.mode.value

        required = self.required

        can_approve = self.can_approve

        pending: dict[str, Any] | None
        if isinstance(self.pending, PageApprovalPendingType0):
            pending = self.pending.to_dict()
        else:
            pending = self.pending

        rejected: dict[str, Any] | None
        if isinstance(self.rejected, PageApprovalRejectedType0):
            rejected = self.rejected.to_dict()
        else:
            rejected = self.rejected


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mode": mode,
            "required": required,
            "canApprove": can_approve,
            "pending": pending,
            "rejected": rejected,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.page_approval_pending_type_0 import PageApprovalPendingType0 # noqa: PLC0415
        from ..models.page_approval_rejected_type_0 import PageApprovalRejectedType0 # noqa: PLC0415
        d = dict(src_dict)
        mode = PageApprovalMode(d.pop("mode"))




        required = d.pop("required")

        can_approve = d.pop("canApprove")

        def _parse_pending(data: object) -> None | PageApprovalPendingType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                pending_type_0 = PageApprovalPendingType0.from_dict(data)



                return pending_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PageApprovalPendingType0, data)

        pending = _parse_pending(d.pop("pending"))


        def _parse_rejected(data: object) -> None | PageApprovalRejectedType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                rejected_type_0 = PageApprovalRejectedType0.from_dict(data)



                return rejected_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PageApprovalRejectedType0, data)

        rejected = _parse_rejected(d.pop("rejected"))


        page_approval = cls(
            mode=mode,
            required=required,
            can_approve=can_approve,
            pending=pending,
            rejected=rejected,
        )

        return page_approval

