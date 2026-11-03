from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.automation_trigger_type_10_event import AutomationTriggerType10Event
from typing import Literal, cast






T = TypeVar("T", bound="AutomationTriggerType10")



@_attrs_define
class AutomationTriggerType10:
    """ 
        Attributes:
            type_ (Literal['git']):
            event (AutomationTriggerType10Event):
     """

    type_: Literal['git']
    event: AutomationTriggerType10Event





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        event = self.event.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "event": event,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['git'] , d.pop("type"))
        if type_ != 'git':
            raise ValueError(f"type must match const 'git', got '{type_}'")

        event = AutomationTriggerType10Event(d.pop("event"))




        automation_trigger_type_10 = cls(
            type_=type_,
            event=event,
        )

        return automation_trigger_type_10

