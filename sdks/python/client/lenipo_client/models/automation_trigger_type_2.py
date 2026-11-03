from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="AutomationTriggerType2")



@_attrs_define
class AutomationTriggerType2:
    """ 
        Attributes:
            type_ (Literal['issue-transitioned']):
            from_ (str):  Default: ''.
            to (str):  Default: ''.
     """

    type_: Literal['issue-transitioned']
    from_: str = ''
    to: str = ''





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        from_ = self.from_

        to = self.to


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "from": from_,
            "to": to,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['issue-transitioned'] , d.pop("type"))
        if type_ != 'issue-transitioned':
            raise ValueError(f"type must match const 'issue-transitioned', got '{type_}'")

        from_ = d.pop("from")

        to = d.pop("to")

        automation_trigger_type_2 = cls(
            type_=type_,
            from_=from_,
            to=to,
        )

        return automation_trigger_type_2

