from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="SecuritySettings")



@_attrs_define
class SecuritySettings:
    """ 
        Attributes:
            session_idle_hours (int):
            session_max_days (int):
            two_factor_group_ids (list[UUID]):
     """

    session_idle_hours: int
    session_max_days: int
    two_factor_group_ids: list[UUID]





    def to_dict(self) -> dict[str, Any]:
        session_idle_hours = self.session_idle_hours

        session_max_days = self.session_max_days

        two_factor_group_ids = []
        for two_factor_group_ids_item_data in self.two_factor_group_ids:
            two_factor_group_ids_item = str(two_factor_group_ids_item_data)
            two_factor_group_ids.append(two_factor_group_ids_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sessionIdleHours": session_idle_hours,
            "sessionMaxDays": session_max_days,
            "twoFactorGroupIds": two_factor_group_ids,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        session_idle_hours = d.pop("sessionIdleHours")

        session_max_days = d.pop("sessionMaxDays")

        two_factor_group_ids = []
        _two_factor_group_ids = d.pop("twoFactorGroupIds")
        for two_factor_group_ids_item_data in (_two_factor_group_ids):
            two_factor_group_ids_item = UUID(two_factor_group_ids_item_data)



            two_factor_group_ids.append(two_factor_group_ids_item)


        security_settings = cls(
            session_idle_hours=session_idle_hours,
            session_max_days=session_max_days,
            two_factor_group_ids=two_factor_group_ids,
        )

        return security_settings

