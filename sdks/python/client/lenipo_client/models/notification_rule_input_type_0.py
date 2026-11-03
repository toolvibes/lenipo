from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.notification_event import NotificationEvent
from ..models.notification_rule_input_type_0_recipient import NotificationRuleInputType0Recipient






T = TypeVar("T", bound="NotificationRuleInputType0")



@_attrs_define
class NotificationRuleInputType0:
    """ 
        Attributes:
            event (NotificationEvent):
            recipient (NotificationRuleInputType0Recipient):
     """

    event: NotificationEvent
    recipient: NotificationRuleInputType0Recipient





    def to_dict(self) -> dict[str, Any]:
        event = self.event.value

        recipient = self.recipient.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "event": event,
            "recipient": recipient,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        event = NotificationEvent(d.pop("event"))




        recipient = NotificationRuleInputType0Recipient(d.pop("recipient"))




        notification_rule_input_type_0 = cls(
            event=event,
            recipient=recipient,
        )

        return notification_rule_input_type_0

