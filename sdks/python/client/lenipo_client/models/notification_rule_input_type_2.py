from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.notification_event import NotificationEvent
from uuid import UUID






T = TypeVar("T", bound="NotificationRuleInputType2")



@_attrs_define
class NotificationRuleInputType2:
    """ 
        Attributes:
            event (NotificationEvent):
            group_id (UUID):
     """

    event: NotificationEvent
    group_id: UUID





    def to_dict(self) -> dict[str, Any]:
        event = self.event.value

        group_id = str(self.group_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "event": event,
            "groupId": group_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        event = NotificationEvent(d.pop("event"))




        group_id = UUID(d.pop("groupId"))




        notification_rule_input_type_2 = cls(
            event=event,
            group_id=group_id,
        )

        return notification_rule_input_type_2

