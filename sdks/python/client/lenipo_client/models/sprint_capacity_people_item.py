from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="SprintCapacityPeopleItem")



@_attrs_define
class SprintCapacityPeopleItem:
    """ 
        Attributes:
            user (UserRef):
            value (float):
     """

    user: UserRef
    value: float





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        user = self.user.to_dict()

        value = self.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "user": user,
            "value": value,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        user = UserRef.from_dict(d.pop("user"))




        value = d.pop("value")

        sprint_capacity_people_item = cls(
            user=user,
            value=value,
        )

        return sprint_capacity_people_item

