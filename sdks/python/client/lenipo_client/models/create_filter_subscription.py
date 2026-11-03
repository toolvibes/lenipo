from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.subscription_schedule import SubscriptionSchedule
from ..types import UNSET, Unset
from uuid import UUID






T = TypeVar("T", bound="CreateFilterSubscription")



@_attrs_define
class CreateFilterSubscription:
    """ 
        Attributes:
            schedule (SubscriptionSchedule):
            weekday (int | Unset):  Default: 1.
            hour (int | Unset):  Default: 8.
            only_with_results (bool | Unset):  Default: True.
            group_id (UUID | Unset):
     """

    schedule: SubscriptionSchedule
    weekday: int | Unset = 1
    hour: int | Unset = 8
    only_with_results: bool | Unset = True
    group_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        schedule = self.schedule.value

        weekday = self.weekday

        hour = self.hour

        only_with_results = self.only_with_results

        group_id: str | Unset = UNSET
        if not isinstance(self.group_id, Unset):
            group_id = str(self.group_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "schedule": schedule,
        })
        if weekday is not UNSET:
            field_dict["weekday"] = weekday
        if hour is not UNSET:
            field_dict["hour"] = hour
        if only_with_results is not UNSET:
            field_dict["onlyWithResults"] = only_with_results
        if group_id is not UNSET:
            field_dict["groupId"] = group_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        schedule = SubscriptionSchedule(d.pop("schedule"))




        weekday = d.pop("weekday", UNSET)

        hour = d.pop("hour", UNSET)

        only_with_results = d.pop("onlyWithResults", UNSET)

        _group_id = d.pop("groupId", UNSET)
        group_id: UUID | Unset
        if isinstance(_group_id,  Unset):
            group_id = UNSET
        else:
            group_id = UUID(_group_id)




        create_filter_subscription = cls(
            schedule=schedule,
            weekday=weekday,
            hour=hour,
            only_with_results=only_with_results,
            group_id=group_id,
        )


        create_filter_subscription.additional_properties = d
        return create_filter_subscription

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
