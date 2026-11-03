from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.notification_rule_input_type_0 import NotificationRuleInputType0
  from ..models.notification_rule_input_type_1 import NotificationRuleInputType1
  from ..models.notification_rule_input_type_2 import NotificationRuleInputType2
  from ..models.notification_rule_input_type_3 import NotificationRuleInputType3





T = TypeVar("T", bound="UpdateNotificationSchemeRequest")



@_attrs_define
class UpdateNotificationSchemeRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (str | Unset):
            rules (list[NotificationRuleInputType0 | NotificationRuleInputType1 | NotificationRuleInputType2 |
                NotificationRuleInputType3] | Unset):
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    rules: list[NotificationRuleInputType0 | NotificationRuleInputType1 | NotificationRuleInputType2 | NotificationRuleInputType3] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.notification_rule_input_type_0 import NotificationRuleInputType0 # noqa: PLC0415
        from ..models.notification_rule_input_type_1 import NotificationRuleInputType1 # noqa: PLC0415
        from ..models.notification_rule_input_type_2 import NotificationRuleInputType2 # noqa: PLC0415
        from ..models.notification_rule_input_type_3 import NotificationRuleInputType3 # noqa: PLC0415
        name = self.name

        description = self.description

        rules: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.rules, Unset):
            rules = []
            for rules_item_data in self.rules:
                rules_item: dict[str, Any]
                if isinstance(rules_item_data, NotificationRuleInputType0):
                    rules_item = rules_item_data.to_dict()
                elif isinstance(rules_item_data, NotificationRuleInputType1):
                    rules_item = rules_item_data.to_dict()
                elif isinstance(rules_item_data, NotificationRuleInputType2):
                    rules_item = rules_item_data.to_dict()
                else:
                    rules_item = rules_item_data.to_dict()

                rules.append(rules_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if rules is not UNSET:
            field_dict["rules"] = rules

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.notification_rule_input_type_0 import NotificationRuleInputType0 # noqa: PLC0415
        from ..models.notification_rule_input_type_1 import NotificationRuleInputType1 # noqa: PLC0415
        from ..models.notification_rule_input_type_2 import NotificationRuleInputType2 # noqa: PLC0415
        from ..models.notification_rule_input_type_3 import NotificationRuleInputType3 # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _rules = d.pop("rules", UNSET)
        rules: list[NotificationRuleInputType0 | NotificationRuleInputType1 | NotificationRuleInputType2 | NotificationRuleInputType3] | Unset = UNSET
        if _rules is not UNSET:
            rules = []
            for rules_item_data in _rules:
                def _parse_rules_item(data: object) -> NotificationRuleInputType0 | NotificationRuleInputType1 | NotificationRuleInputType2 | NotificationRuleInputType3:
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_notification_rule_input_type_0 = NotificationRuleInputType0.from_dict(data)



                        return componentsschemas_notification_rule_input_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_notification_rule_input_type_1 = NotificationRuleInputType1.from_dict(data)



                        return componentsschemas_notification_rule_input_type_1
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_notification_rule_input_type_2 = NotificationRuleInputType2.from_dict(data)



                        return componentsschemas_notification_rule_input_type_2
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_notification_rule_input_type_3 = NotificationRuleInputType3.from_dict(data)



                    return componentsschemas_notification_rule_input_type_3

                rules_item = _parse_rules_item(rules_item_data)

                rules.append(rules_item)


        update_notification_scheme_request = cls(
            name=name,
            description=description,
            rules=rules,
        )


        update_notification_scheme_request.additional_properties = d
        return update_notification_scheme_request

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
