from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.automation_rule_last_run_type_0 import AutomationRuleLastRunType0
  from ..models.automation_rule_owner_type_0 import AutomationRuleOwnerType0
  from ..models.automation_rule_project_type_0 import AutomationRuleProjectType0
  from ..models.automation_trigger_type_0 import AutomationTriggerType0
  from ..models.automation_trigger_type_1 import AutomationTriggerType1
  from ..models.automation_trigger_type_10 import AutomationTriggerType10
  from ..models.automation_trigger_type_2 import AutomationTriggerType2
  from ..models.automation_trigger_type_3 import AutomationTriggerType3
  from ..models.automation_trigger_type_4 import AutomationTriggerType4
  from ..models.automation_trigger_type_5 import AutomationTriggerType5
  from ..models.automation_trigger_type_6 import AutomationTriggerType6
  from ..models.automation_trigger_type_7 import AutomationTriggerType7
  from ..models.automation_trigger_type_8 import AutomationTriggerType8
  from ..models.automation_trigger_type_9 import AutomationTriggerType9





T = TypeVar("T", bound="AutomationRule")



@_attrs_define
class AutomationRule:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            enabled (bool):
            project (AutomationRuleProjectType0 | None):
            trigger (AutomationTriggerType0 | AutomationTriggerType1 | AutomationTriggerType10 | AutomationTriggerType2 |
                AutomationTriggerType3 | AutomationTriggerType4 | AutomationTriggerType5 | AutomationTriggerType6 |
                AutomationTriggerType7 | AutomationTriggerType8 | AutomationTriggerType9):
            components (list[Any]):
            allow_self_trigger (bool):
            owner (AutomationRuleOwnerType0 | None):
            disabled_reason (None | str):
            webhook_url (None | str):
            last_run (AutomationRuleLastRunType0 | None):
            can_edit (bool):
            updated_at (datetime.datetime):
     """

    id: UUID
    name: str
    description: str
    enabled: bool
    project: AutomationRuleProjectType0 | None
    trigger: AutomationTriggerType0 | AutomationTriggerType1 | AutomationTriggerType10 | AutomationTriggerType2 | AutomationTriggerType3 | AutomationTriggerType4 | AutomationTriggerType5 | AutomationTriggerType6 | AutomationTriggerType7 | AutomationTriggerType8 | AutomationTriggerType9
    components: list[Any]
    allow_self_trigger: bool
    owner: AutomationRuleOwnerType0 | None
    disabled_reason: None | str
    webhook_url: None | str
    last_run: AutomationRuleLastRunType0 | None
    can_edit: bool
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.automation_rule_last_run_type_0 import AutomationRuleLastRunType0 # noqa: PLC0415
        from ..models.automation_rule_owner_type_0 import AutomationRuleOwnerType0 # noqa: PLC0415
        from ..models.automation_rule_project_type_0 import AutomationRuleProjectType0 # noqa: PLC0415
        from ..models.automation_trigger_type_0 import AutomationTriggerType0 # noqa: PLC0415
        from ..models.automation_trigger_type_1 import AutomationTriggerType1 # noqa: PLC0415
        from ..models.automation_trigger_type_10 import AutomationTriggerType10 # noqa: PLC0415
        from ..models.automation_trigger_type_2 import AutomationTriggerType2 # noqa: PLC0415
        from ..models.automation_trigger_type_3 import AutomationTriggerType3 # noqa: PLC0415
        from ..models.automation_trigger_type_4 import AutomationTriggerType4 # noqa: PLC0415
        from ..models.automation_trigger_type_5 import AutomationTriggerType5 # noqa: PLC0415
        from ..models.automation_trigger_type_6 import AutomationTriggerType6 # noqa: PLC0415
        from ..models.automation_trigger_type_7 import AutomationTriggerType7 # noqa: PLC0415
        from ..models.automation_trigger_type_8 import AutomationTriggerType8 # noqa: PLC0415
        from ..models.automation_trigger_type_9 import AutomationTriggerType9 # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        enabled = self.enabled

        project: dict[str, Any] | None
        if isinstance(self.project, AutomationRuleProjectType0):
            project = self.project.to_dict()
        else:
            project = self.project

        trigger: dict[str, Any]
        if isinstance(self.trigger, AutomationTriggerType0):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType1):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType2):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType3):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType4):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType5):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType6):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType7):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType8):
            trigger = self.trigger.to_dict()
        elif isinstance(self.trigger, AutomationTriggerType9):
            trigger = self.trigger.to_dict()
        else:
            trigger = self.trigger.to_dict()


        components = self.components



        allow_self_trigger = self.allow_self_trigger

        owner: dict[str, Any] | None
        if isinstance(self.owner, AutomationRuleOwnerType0):
            owner = self.owner.to_dict()
        else:
            owner = self.owner

        disabled_reason: None | str
        disabled_reason = self.disabled_reason

        webhook_url: None | str
        webhook_url = self.webhook_url

        last_run: dict[str, Any] | None
        if isinstance(self.last_run, AutomationRuleLastRunType0):
            last_run = self.last_run.to_dict()
        else:
            last_run = self.last_run

        can_edit = self.can_edit

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "enabled": enabled,
            "project": project,
            "trigger": trigger,
            "components": components,
            "allowSelfTrigger": allow_self_trigger,
            "owner": owner,
            "disabledReason": disabled_reason,
            "webhookUrl": webhook_url,
            "lastRun": last_run,
            "canEdit": can_edit,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.automation_rule_last_run_type_0 import AutomationRuleLastRunType0 # noqa: PLC0415
        from ..models.automation_rule_owner_type_0 import AutomationRuleOwnerType0 # noqa: PLC0415
        from ..models.automation_rule_project_type_0 import AutomationRuleProjectType0 # noqa: PLC0415
        from ..models.automation_trigger_type_0 import AutomationTriggerType0 # noqa: PLC0415
        from ..models.automation_trigger_type_1 import AutomationTriggerType1 # noqa: PLC0415
        from ..models.automation_trigger_type_10 import AutomationTriggerType10 # noqa: PLC0415
        from ..models.automation_trigger_type_2 import AutomationTriggerType2 # noqa: PLC0415
        from ..models.automation_trigger_type_3 import AutomationTriggerType3 # noqa: PLC0415
        from ..models.automation_trigger_type_4 import AutomationTriggerType4 # noqa: PLC0415
        from ..models.automation_trigger_type_5 import AutomationTriggerType5 # noqa: PLC0415
        from ..models.automation_trigger_type_6 import AutomationTriggerType6 # noqa: PLC0415
        from ..models.automation_trigger_type_7 import AutomationTriggerType7 # noqa: PLC0415
        from ..models.automation_trigger_type_8 import AutomationTriggerType8 # noqa: PLC0415
        from ..models.automation_trigger_type_9 import AutomationTriggerType9 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        enabled = d.pop("enabled")

        def _parse_project(data: object) -> AutomationRuleProjectType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                project_type_0 = AutomationRuleProjectType0.from_dict(data)



                return project_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AutomationRuleProjectType0 | None, data)

        project = _parse_project(d.pop("project"))


        def _parse_trigger(data: object) -> AutomationTriggerType0 | AutomationTriggerType1 | AutomationTriggerType10 | AutomationTriggerType2 | AutomationTriggerType3 | AutomationTriggerType4 | AutomationTriggerType5 | AutomationTriggerType6 | AutomationTriggerType7 | AutomationTriggerType8 | AutomationTriggerType9:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_0 = AutomationTriggerType0.from_dict(data)



                return componentsschemas_automation_trigger_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_1 = AutomationTriggerType1.from_dict(data)



                return componentsschemas_automation_trigger_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_2 = AutomationTriggerType2.from_dict(data)



                return componentsschemas_automation_trigger_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_3 = AutomationTriggerType3.from_dict(data)



                return componentsschemas_automation_trigger_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_4 = AutomationTriggerType4.from_dict(data)



                return componentsschemas_automation_trigger_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_5 = AutomationTriggerType5.from_dict(data)



                return componentsschemas_automation_trigger_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_6 = AutomationTriggerType6.from_dict(data)



                return componentsschemas_automation_trigger_type_6
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_7 = AutomationTriggerType7.from_dict(data)



                return componentsschemas_automation_trigger_type_7
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_8 = AutomationTriggerType8.from_dict(data)



                return componentsschemas_automation_trigger_type_8
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_automation_trigger_type_9 = AutomationTriggerType9.from_dict(data)



                return componentsschemas_automation_trigger_type_9
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_automation_trigger_type_10 = AutomationTriggerType10.from_dict(data)



            return componentsschemas_automation_trigger_type_10

        trigger = _parse_trigger(d.pop("trigger"))


        components = cast(list[Any], d.pop("components"))


        allow_self_trigger = d.pop("allowSelfTrigger")

        def _parse_owner(data: object) -> AutomationRuleOwnerType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                owner_type_0 = AutomationRuleOwnerType0.from_dict(data)



                return owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AutomationRuleOwnerType0 | None, data)

        owner = _parse_owner(d.pop("owner"))


        def _parse_disabled_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        disabled_reason = _parse_disabled_reason(d.pop("disabledReason"))


        def _parse_webhook_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        webhook_url = _parse_webhook_url(d.pop("webhookUrl"))


        def _parse_last_run(data: object) -> AutomationRuleLastRunType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                last_run_type_0 = AutomationRuleLastRunType0.from_dict(data)



                return last_run_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AutomationRuleLastRunType0 | None, data)

        last_run = _parse_last_run(d.pop("lastRun"))


        can_edit = d.pop("canEdit")

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        automation_rule = cls(
            id=id,
            name=name,
            description=description,
            enabled=enabled,
            project=project,
            trigger=trigger,
            components=components,
            allow_self_trigger=allow_self_trigger,
            owner=owner,
            disabled_reason=disabled_reason,
            webhook_url=webhook_url,
            last_run=last_run,
            can_edit=can_edit,
            updated_at=updated_at,
        )

        return automation_rule

