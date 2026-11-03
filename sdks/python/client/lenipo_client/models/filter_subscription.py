from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.subscription_schedule import SubscriptionSchedule
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.filter_subscription_group_type_0 import FilterSubscriptionGroupType0
  from ..models.filter_subscription_subscriber import FilterSubscriptionSubscriber





T = TypeVar("T", bound="FilterSubscription")



@_attrs_define
class FilterSubscription:
    """ 
        Attributes:
            id (UUID):
            filter_id (UUID):
            schedule (SubscriptionSchedule):
            weekday (int):
            hour (int):
            only_with_results (bool):
            subscriber (FilterSubscriptionSubscriber):
            group (FilterSubscriptionGroupType0 | None):
            last_sent_at (datetime.datetime | None):
            can_delete (bool):
     """

    id: UUID
    filter_id: UUID
    schedule: SubscriptionSchedule
    weekday: int
    hour: int
    only_with_results: bool
    subscriber: FilterSubscriptionSubscriber
    group: FilterSubscriptionGroupType0 | None
    last_sent_at: datetime.datetime | None
    can_delete: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.filter_subscription_group_type_0 import FilterSubscriptionGroupType0 # noqa: PLC0415
        from ..models.filter_subscription_subscriber import FilterSubscriptionSubscriber # noqa: PLC0415
        id = str(self.id)

        filter_id = str(self.filter_id)

        schedule = self.schedule.value

        weekday = self.weekday

        hour = self.hour

        only_with_results = self.only_with_results

        subscriber = self.subscriber.to_dict()

        group: dict[str, Any] | None
        if isinstance(self.group, FilterSubscriptionGroupType0):
            group = self.group.to_dict()
        else:
            group = self.group

        last_sent_at: None | str
        if isinstance(self.last_sent_at, datetime.datetime):
            last_sent_at = self.last_sent_at.isoformat()
        else:
            last_sent_at = self.last_sent_at

        can_delete = self.can_delete


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "filterId": filter_id,
            "schedule": schedule,
            "weekday": weekday,
            "hour": hour,
            "onlyWithResults": only_with_results,
            "subscriber": subscriber,
            "group": group,
            "lastSentAt": last_sent_at,
            "canDelete": can_delete,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.filter_subscription_group_type_0 import FilterSubscriptionGroupType0 # noqa: PLC0415
        from ..models.filter_subscription_subscriber import FilterSubscriptionSubscriber # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        filter_id = UUID(d.pop("filterId"))




        schedule = SubscriptionSchedule(d.pop("schedule"))




        weekday = d.pop("weekday")

        hour = d.pop("hour")

        only_with_results = d.pop("onlyWithResults")

        subscriber = FilterSubscriptionSubscriber.from_dict(d.pop("subscriber"))




        def _parse_group(data: object) -> FilterSubscriptionGroupType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                group_type_0 = FilterSubscriptionGroupType0.from_dict(data)



                return group_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FilterSubscriptionGroupType0 | None, data)

        group = _parse_group(d.pop("group"))


        def _parse_last_sent_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_sent_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_sent_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_sent_at = _parse_last_sent_at(d.pop("lastSentAt"))


        can_delete = d.pop("canDelete")

        filter_subscription = cls(
            id=id,
            filter_id=filter_id,
            schedule=schedule,
            weekday=weekday,
            hour=hour,
            only_with_results=only_with_results,
            subscriber=subscriber,
            group=group,
            last_sent_at=last_sent_at,
            can_delete=can_delete,
        )

        return filter_subscription

