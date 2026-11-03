from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="TimeReportPeopleItem")



@_attrs_define
class TimeReportPeopleItem:
    """ 
        Attributes:
            user (None | UserRef):
            logged_seconds (int):
     """

    user: None | UserRef
    logged_seconds: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        user: dict[str, Any] | None
        if isinstance(self.user, UserRef):
            user = self.user.to_dict()
        else:
            user = self.user

        logged_seconds = self.logged_seconds


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "user": user,
            "loggedSeconds": logged_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        def _parse_user(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                user_type_0 = UserRef.from_dict(data)



                return user_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        user = _parse_user(d.pop("user"))


        logged_seconds = d.pop("loggedSeconds")

        time_report_people_item = cls(
            user=user,
            logged_seconds=logged_seconds,
        )

        return time_report_people_item

