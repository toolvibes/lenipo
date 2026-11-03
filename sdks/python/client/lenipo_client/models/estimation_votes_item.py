from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.estimate_card import EstimateCard
from typing import cast

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="EstimationVotesItem")



@_attrs_define
class EstimationVotesItem:
    """ 
        Attributes:
            user (UserRef):
            value (EstimateCard | None):
     """

    user: UserRef
    value: EstimateCard | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        user = self.user.to_dict()

        value: None | str
        if isinstance(self.value, EstimateCard):
            value = self.value.value
        else:
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




        def _parse_value(data: object) -> EstimateCard | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                value_type_0 = EstimateCard(data)



                return value_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EstimateCard | None, data)

        value = _parse_value(d.pop("value"))


        estimation_votes_item = cls(
            user=user,
            value=value,
        )

        return estimation_votes_item

