from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="AgentPause")



@_attrs_define
class AgentPause:
    """ 
        Attributes:
            at (datetime.datetime):
            by (None | UserRef):
            reason (str):
     """

    at: datetime.datetime
    by: None | UserRef
    reason: str





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        at = self.at.isoformat()

        by: dict[str, Any] | None
        if isinstance(self.by, UserRef):
            by = self.by.to_dict()
        else:
            by = self.by

        reason = self.reason


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "at": at,
            "by": by,
            "reason": reason,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        at = datetime.datetime.fromisoformat(d.pop("at"))




        def _parse_by(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                by_type_0 = UserRef.from_dict(data)



                return by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        by = _parse_by(d.pop("by"))


        reason = d.pop("reason")

        agent_pause = cls(
            at=at,
            by=by,
            reason=reason,
        )

        return agent_pause

