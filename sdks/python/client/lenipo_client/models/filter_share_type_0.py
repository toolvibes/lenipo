from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="FilterShareType0")



@_attrs_define
class FilterShareType0:
    """ 
        Attributes:
            type_ (Literal['user']):
            user (UserRef):
     """

    type_: Literal['user']
    user: UserRef





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        type_ = self.type_

        user = self.user.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "user": user,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        type_ = cast(Literal['user'] , d.pop("type"))
        if type_ != 'user':
            raise ValueError(f"type must match const 'user', got '{type_}'")

        user = UserRef.from_dict(d.pop("user"))




        filter_share_type_0 = cls(
            type_=type_,
            user=user,
        )

        return filter_share_type_0

