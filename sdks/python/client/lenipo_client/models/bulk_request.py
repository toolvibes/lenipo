from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.bulk_action_type_0 import BulkActionType0
  from ..models.bulk_action_type_1 import BulkActionType1
  from ..models.bulk_action_type_2 import BulkActionType2
  from ..models.bulk_action_type_3 import BulkActionType3
  from ..models.bulk_action_type_4 import BulkActionType4
  from ..models.bulk_action_type_5 import BulkActionType5
  from ..models.bulk_action_type_6 import BulkActionType6





T = TypeVar("T", bound="BulkRequest")



@_attrs_define
class BulkRequest:
    """ 
        Attributes:
            issue_keys (list[str]):
            action (BulkActionType0 | BulkActionType1 | BulkActionType2 | BulkActionType3 | BulkActionType4 |
                BulkActionType5 | BulkActionType6):
     """

    issue_keys: list[str]
    action: BulkActionType0 | BulkActionType1 | BulkActionType2 | BulkActionType3 | BulkActionType4 | BulkActionType5 | BulkActionType6
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.bulk_action_type_0 import BulkActionType0 # noqa: PLC0415
        from ..models.bulk_action_type_1 import BulkActionType1 # noqa: PLC0415
        from ..models.bulk_action_type_2 import BulkActionType2 # noqa: PLC0415
        from ..models.bulk_action_type_3 import BulkActionType3 # noqa: PLC0415
        from ..models.bulk_action_type_4 import BulkActionType4 # noqa: PLC0415
        from ..models.bulk_action_type_5 import BulkActionType5 # noqa: PLC0415
        from ..models.bulk_action_type_6 import BulkActionType6 # noqa: PLC0415
        issue_keys = self.issue_keys



        action: dict[str, Any]
        if isinstance(self.action, BulkActionType0):
            action = self.action.to_dict()
        elif isinstance(self.action, BulkActionType1):
            action = self.action.to_dict()
        elif isinstance(self.action, BulkActionType2):
            action = self.action.to_dict()
        elif isinstance(self.action, BulkActionType3):
            action = self.action.to_dict()
        elif isinstance(self.action, BulkActionType4):
            action = self.action.to_dict()
        elif isinstance(self.action, BulkActionType5):
            action = self.action.to_dict()
        else:
            action = self.action.to_dict()



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "issueKeys": issue_keys,
            "action": action,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.bulk_action_type_0 import BulkActionType0 # noqa: PLC0415
        from ..models.bulk_action_type_1 import BulkActionType1 # noqa: PLC0415
        from ..models.bulk_action_type_2 import BulkActionType2 # noqa: PLC0415
        from ..models.bulk_action_type_3 import BulkActionType3 # noqa: PLC0415
        from ..models.bulk_action_type_4 import BulkActionType4 # noqa: PLC0415
        from ..models.bulk_action_type_5 import BulkActionType5 # noqa: PLC0415
        from ..models.bulk_action_type_6 import BulkActionType6 # noqa: PLC0415
        d = dict(src_dict)
        issue_keys = cast(list[str], d.pop("issueKeys"))


        def _parse_action(data: object) -> BulkActionType0 | BulkActionType1 | BulkActionType2 | BulkActionType3 | BulkActionType4 | BulkActionType5 | BulkActionType6:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_bulk_action_type_0 = BulkActionType0.from_dict(data)



                return componentsschemas_bulk_action_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_bulk_action_type_1 = BulkActionType1.from_dict(data)



                return componentsschemas_bulk_action_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_bulk_action_type_2 = BulkActionType2.from_dict(data)



                return componentsschemas_bulk_action_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_bulk_action_type_3 = BulkActionType3.from_dict(data)



                return componentsschemas_bulk_action_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_bulk_action_type_4 = BulkActionType4.from_dict(data)



                return componentsschemas_bulk_action_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_bulk_action_type_5 = BulkActionType5.from_dict(data)



                return componentsschemas_bulk_action_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_bulk_action_type_6 = BulkActionType6.from_dict(data)



            return componentsschemas_bulk_action_type_6

        action = _parse_action(d.pop("action"))


        bulk_request = cls(
            issue_keys=issue_keys,
            action=action,
        )


        bulk_request.additional_properties = d
        return bulk_request

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
