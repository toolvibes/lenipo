from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="AutomationTriggerType8")



@_attrs_define
class AutomationTriggerType8:
    """ 
        Attributes:
            type_ (Literal['schedule']):
            cron (str):
            query (str):  Default: ''.
     """

    type_: Literal['schedule']
    cron: str
    query: str = ''





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        cron = self.cron

        query = self.query


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "cron": cron,
            "query": query,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['schedule'] , d.pop("type"))
        if type_ != 'schedule':
            raise ValueError(f"type must match const 'schedule', got '{type_}'")

        cron = d.pop("cron")

        query = d.pop("query")

        automation_trigger_type_8 = cls(
            type_=type_,
            cron=cron,
            query=query,
        )

        return automation_trigger_type_8

