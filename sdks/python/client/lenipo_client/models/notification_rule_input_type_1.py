from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.notification_event import NotificationEvent
from ..models.project_role import ProjectRole






T = TypeVar("T", bound="NotificationRuleInputType1")



@_attrs_define
class NotificationRuleInputType1:
    """ 
        Attributes:
            event (NotificationEvent):
            role (ProjectRole):
     """

    event: NotificationEvent
    role: ProjectRole





    def to_dict(self) -> dict[str, Any]:
        event = self.event.value

        role = self.role.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "event": event,
            "role": role,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        event = NotificationEvent(d.pop("event"))




        role = ProjectRole(d.pop("role"))




        notification_rule_input_type_1 = cls(
            event=event,
            role=role,
        )

        return notification_rule_input_type_1

